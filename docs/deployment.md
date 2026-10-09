# Deployment

## Platform

Vercel — configured for Nuxt 4 SSR.

## Pre-Deployment Checklist

1. **Database**: Ensure all migrations are applied
   ```bash
   npx prisma migrate deploy
   ```

2. **Environment Variables**: Set all required vars in Vercel dashboard:
   - `DATABASE_URL`
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `SITE_URL` (must be production URL, not localhost)
   - `RESEND_API_KEY`, `EMAIL_FROM`, `RESEND_WEBHOOK_SECRET` — optional in dev, **required
     in production**. See [Mail](#mail-is-required-in-production).

   A missing one is fatal at boot: `server/plugins/configValidation.ts` throws and the
   function never serves a request, which is the point — the alternative is a green deploy
   that silently does nothing.

3. **Optional Variables**: Configure if needed:
   - `ADMIN_EMAIL` + `ADMIN_PASSWORD` (first-admin bootstrap — see below)
   - `HSTS_MAX_AGE` + `HSTS_INCLUDE_SUBDOMAINS` — see [HSTS rollout](#hsts-rollout)
   - `TRUSTED_PROXY_HOPS` — see [`security.md`](./security.md)

   Google sign-in needs no variables here. The OAuth application is configured in the
   **Supabase dashboard** and proxied through `/api/auth/google-start`, so no client id,
   client secret or JWT signing key of our own is read anywhere. An earlier revision of
   this guide listed three such variables; nothing in the codebase ever consumed them.

4. **Build Command**: `npm run build` (default for Nuxt)

5. **Node Version**: Ensure `^22.19.0 || ^24.11.0 || >=26.0.0`

6. **Legal copy**: `/privacy` and `/terms` are unreviewed placeholders, kept out of the
   index until a lawyer has read them — see [Legal pages](#legal-pages).

## Secrets are read at runtime, not baked into the build

`runtimeConfig` in `nuxt.config.ts` holds **empty strings** for every private value. A
`process.env.X` written there would be evaluated on the build machine and inlined into
`.output`, so the deployed artifact would carry the secret and a rotated one would keep
serving the old value until the next build.

`resolveEnvValue()` in `server/utils/config.ts` reads each value at request time instead:

| Set this | Then this wins |
|----------|----------------|
| `NUXT_RESEND_API_KEY` | runtime override — rotating it needs a restart, not a rebuild |
| `RESEND_API_KEY` | the bare name, which is what `.env` and the Vercel dashboard provide |

Both spellings work for `DATABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`,
`RESEND_API_KEY`, `EMAIL_FROM`, `ADMIN_EMAIL` and `ADMIN_PASSWORD`.

The public pair — `SITE_URL`, `SUPABASE_URL` — is still resolved at build time, because the
client bundle reads the same object and has no environment to fall back to. Neither is a
secret. `RESEND_WEBHOOK_SECRET` is read from the environment alone: the webhook verifies
signatures outside any Nuxt runtime.

## Mail is required in production

Mail is the only channel that reaches an applicant or an organizer. A deployment without it
is not "email disabled" — it is a catalog that never tells anyone their application arrived,
and every message lands in `EmailEvent` as `SKIPPED`.

So in production all three are required and a missing one stops the boot:

| Variable | Without it |
|----------|-----------|
| `RESEND_API_KEY` | nothing is ever delivered |
| `EMAIL_FROM` | sends would use the `noreply@psygroup.org` fallback, which is not a verified sender on your Resend account |
| `RESEND_WEBHOOK_SECRET` | `POST /api/webhooks/resend` answers 401, so delivery statuses stay at `SENT` forever |

In dev all three stay optional and are reported as
`⚠️  Not set here, required in production: …` on every boot.

## HSTS rollout

`Strict-Transport-Security` cannot be revoked. Once a browser has seen
`max-age=31536000; includeSubDomains` it refuses plain HTTP for that host **and every
subdomain** for a year — including a subdomain whose certificate later lapses. The default
is therefore deliberately short:

```
max-age=300        # the default, no configuration needed
```

Raise it in steps, one deploy at a time:

1. **First deploy** — leave the default (`max-age=300`, five minutes).
2. **Check every subdomain** (`www`, `api`, `admin`, …) serves a valid certificate over
   HTTPS. Anything that does not must be fixed or retired before step 4.
3. `HSTS_MAX_AGE=86400` — one day. Leave it a week.
4. `HSTS_MAX_AGE=31536000` and `HSTS_INCLUDE_SUBDOMAINS=true` — one year, all subdomains.
5. Optional: submit the domain to the [HSTS preload list](https://hstspreload.org). This is
   the irreversible step; it cannot be undone for any subdomain.

Rolling back is `HSTS_MAX_AGE=0`, which tells browsers to forget the policy — but only for
browsers that visit again, and not at all once the domain is preloaded.

## CI and Preview builds

`prisma.config.ts` omits the datasource entirely when `DATABASE_URL` is absent instead of
throwing, so `postinstall` (`prisma generate`) and `nuxt build` both work in a job that has
no database. Only the commands that touch one — `prisma migrate deploy`, `db pull`,
`studio` — need the real URL, and they fail with Prisma's own missing-datasource message
rather than a connection error for a placeholder host.

## Legal pages

`/ua/privacy`, `/en/privacy`, `/ua/terms` and `/en/terms` ship as placeholder copy and are
marked `noindex, nofollow` and left out of `sitemap.xml`. They stay **crawlable** on
purpose: a `Disallow` in `robots.txt` would hide the very tag that keeps them out of the
index.

Before launch, have the copy reviewed and then remove `robots: 'noindex, nofollow'` from
both pages and add the paths back to `staticPaths` in `server/routes/sitemap.xml.ts`. The
TODO is in the template of each page.

## First admin bootstrap

A fresh production database contains no `ADMIN`: `database/seed.ts` refuses to run outside
localhost, and registration only ever creates `VISITOR` or `ORGANIZER`. Without an admin
nobody verifies organizers and nobody publishes groups, so the catalog stays empty forever.

`server/plugins/adminBootstrap.ts` closes that gap on every cold start:

1. `SELECT count(*) FROM "User" WHERE role = 'ADMIN'` — if it is not zero, the plugin stops.
   This is the whole cost once an admin exists: one query per Vercel cold start.
2. If `ADMIN_EMAIL` or `ADMIN_PASSWORD` is unset, it logs
   `[bootstrap] no admin in database and ADMIN_EMAIL/ADMIN_PASSWORD not set` and stops. The
   application still starts — the bootstrap never throws.
3. Otherwise it creates the Supabase auth account (`email_confirm: true`), then the
   `public.User` row with `role: 'ADMIN'`. An address that already exists in `auth.users`
   with no `public.User` row is treated as an orphan, deleted and replayed; an address that
   already has a `public.User` row is **promoted** to `ADMIN` instead, so no existing
   session is destroyed.
4. Two instances cold-starting at once race on the unique email index. The loser catches
   `P2002` and reports the admin as present.

After the first admin exists the variables are ignored — setting them later does not create
a second admin, and rotating `ADMIN_PASSWORD` in the dashboard does not change the account's
password. Remove them from Vercel once the panel is reachable.

`npm run db:seed` reads the same two variables, falling back to `admin@example.com` /
`admin12345` for local development only.

## Post-Deployment Checklist

- [ ] Config validation plugin logs "All required env variables are set"
- [ ] Function logs show `[bootstrap] created the first ADMIN` (or `already-present` on a
      database that has one), and `/admin` is reachable with `ADMIN_EMAIL`
- [ ] Homepage loads in both `/ua` and `/en`
- [ ] Auth flow works (register, login, logout)
- [ ] Group catalog loads with filters
- [ ] Application form submits successfully
- [ ] Email notifications are sent (check EmailEvent table — `SENT`, not `SKIPPED`)
- [ ] Rate limiting is active (not dev mode), and a limiter store failure lets requests
      through instead of answering 429
- [ ] CSP headers present in responses
- [ ] HSTS header present, and still `max-age=300` until the
      [rollout](#hsts-rollout) is finished
- [ ] No `x-powered-by` response header
- [ ] `/sitemap.xml` lists no `/privacy` or `/terms` URL while those pages are `noindex`

## Database Migrations in Production

```bash
# Apply pending migrations
npx prisma migrate deploy

# Check migration status
npx prisma migrate status
```

Never run `prisma migrate dev` in production — it may create destructive changes.

## Environment-Specific Behavior

| Feature | Development | Production |
|---------|------------|------------|
| Rate limiting | Disabled | Active |
| CSP | Relaxed (HMR, eval) | Strict |
| Source maps | Enabled | Disabled |
| DevTools | Enabled | Disabled |
| Config validation | Warns on optional and on the mail trio | Throws on missing required, mail included |
| Email delivery | `DEV_PREVIEW` row, no provider call | Real send through Resend |
| HSTS | `max-age=300` (header is meaningless over HTTP anyway) | `max-age=300` until the rollout raises it |
| First-admin bootstrap | Same code path; usually a noop because the seed created one | Creates the only ADMIN on an empty database |
