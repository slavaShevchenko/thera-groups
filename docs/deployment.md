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
   - `SITE_URL` (must be the production URL — in production it has to start with `https://`
     and must not be localhost, or boot fails; see
     [SITE_URL](#site_url-must-be-https-in-production))
   - `RESEND_API_KEY`, `EMAIL_FROM`, `RESEND_WEBHOOK_SECRET` — optional in dev, **required
     in production**. See [Mail](#mail-is-required-in-production).

   A missing one is fatal at boot: `server/plugins/configValidation.ts` throws and the
   function never serves a request, which is the point — the alternative is a green deploy
   that silently does nothing.

3. **Optional Variables**: Configure if needed:
   - `ADMIN_EMAIL` + `ADMIN_PASSWORD` (first-admin bootstrap — see below)
   - `HSTS_MAX_AGE` + `HSTS_INCLUDE_SUBDOMAINS` — see [HSTS rollout](#hsts-rollout)
   - `TRUSTED_PROXY_HOPS` — see [`security.md`](./security.md)
   - `STORAGE_BUCKET_ORGANIZER_AVATARS` — only if you named the bucket something other than
     the default. **The bucket itself is not created by anything in this repo**: see
     [Storage buckets](#storage-buckets), which is a required manual step on a new project

   Google sign-in needs no variables here. The OAuth application is configured in the
   **Supabase dashboard** and proxied through `/api/auth/google-start`, so no client id,
   client secret or JWT signing key of our own is read anywhere. An earlier revision of
   this guide listed three such variables; nothing in the codebase ever consumed them.

4. **Google OAuth callback URLs**: Supabase refuses any `redirectTo` outside its allowlist,
   and `server/api/auth/google-start.get.ts` builds one per locale from **`SITE_URL`** (never
   from the request's host — see
   [`authentication.md`](./authentication.md#the-redirect-allowlist)), so the two entries must
   match the `SITE_URL` above character for character:

   ```
   https://psygroup.org/ua/auth/callback
   https://psygroup.org/en/auth/callback
   ```

   Add **both** in Supabase dashboard → **Authentication → URL Configuration → Redirect
   URLs**, and set **Site URL** to the same bare origin (`https://psygroup.org`). A preview
   deployment inherits `SITE_URL`, so a sign-in started there completes on the production
   domain and the preview stays signed out — test Google sign-in locally instead.

   A missing entry is silent: the deploy succeeds, `configValidation` reports all variables
   present, and Google simply lands the browser on the Site URL instead of the callback page.
   With Supabase's factory default still in place that Site URL is `http://localhost:3000`, so
   the report reads "production sign-in throws me to localhost". Nothing in the function logs
   explains it, so this is worth checking before launch rather than debugging from a
   "sign-in does nothing" report. See
   [`authentication.md`](./authentication.md#google-oauth).

5. **Storage bucket**: create `organizer-avatars` in Supabase Storage, public, with a SELECT
   policy for the `public` role. No migration does this and every avatar upload returns 500
   without it — full steps in [Storage buckets](#storage-buckets).

6. **Build Command**: `npm run build` (default for Nuxt)

7. **Node Version**: Ensure `^22.19.0 || ^24.11.0 || >=26.0.0`

8. **Legal copy**: `/privacy` and `/terms` are unreviewed placeholders, kept out of the
   index until a lawyer has read them — see [Legal pages](#legal-pages).

9. **Test data**: the database still holds organizer, group and auth accounts created while
   developing. Run [`scripts/cleanup-test-data.sql`](#removing-test-data-before-launch)
   against the production database before the first public deploy.

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
`RESEND_API_KEY`, `EMAIL_FROM`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` and
`STORAGE_BUCKET_ORGANIZER_AVATARS`.

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

## SITE_URL must be https in production

`SITE_URL` has a localhost fallback in `nuxt.config.ts`, so the "is it set" check never fires
for it. It gets two extra production-only rules instead, because this one value is what every
canonical URL, every `sitemap.xml` entry and every Open Graph tag is built from:

- **localhost** points all of them at a host nobody else can reach;
- a plain **`http://`** points them at a scheme the site itself refuses — HSTS and the `secure`
  cookie flag turn every such URL into a redirect. Google reads an http canonical on an https
  page as a mismatch and does not adopt it, so a wrong scheme silently publishes the whole
  sitemap at URLs the deployment never serves.

`validateServerEnv()` in `server/utils/config.ts` reports `SITE_URL` as missing in either
case, and the plugin throws. Dev is unaffected: a local server has no certificate to have.

## Function duration and mail

Every `sendEmail()` is awaited, so the provider round-trip is part of the request that
triggered it. That is deliberate: a detached send is not guaranteed to finish on Vercel.
Nitro's Vercel runtime is a plain `toNodeListener` with no background-work hook, and
`event.context.waitUntil` is only populated from a workerd-style fetch context that runtime
never sets — so once the response went out, nothing kept the instance alive long enough to
deliver. It always worked locally, because a dev server is a long-lived process.

`nuxt.config.ts` therefore sets:

```ts
nitro: { vercel: { functions: { maxDuration: 60 } } }
```

60s is the ceiling the Hobby plan allows, against a 10s default. It is needed because
`server/services/email/transport.ts` can spend up to 35s on a single message (3 attempts ×
10s timeout + 1s/4s backoff), which would otherwise kill the function mid-send and lose the
HTTP response along with the email.

What it does **not** solve on its own: a degraded Resend costs up to 35s *per message*, so the
second batch of a cancellation fan-out would end past 60s and Vercel would kill the function —
losing the HTTP response *and* every letter not yet started. Being killed is the worst outcome
available here, because a letter that never started never called `sendEmail` and therefore
leaves no `EmailEvent` row: the mail is gone with nothing in the database to show for it, and
the organizer is shown a failure for a cancellation that committed.

`EMAIL_FANOUT_BUDGET_MS` in `server/utils/notifications.ts` stops a fan-out at 40s instead,
always after at least one batch. The organizer sees the cancellation succeed — it did — and the
recipients it cut off are named in a `console.error` line, which is the only record they have.
What *was* attempted stays visible in `EmailEvent`, since `sendEmail` never throws and writes
its outcome there. A durable fix is a queue or a background function, not a longer timeout or a
bigger budget.

Three related budgets worth knowing before changing any of them:

| Budget | Value | Where |
|--------|-------|-------|
| Fan-out concurrency | 3 in flight | `EMAIL_CONCURRENCY` in `server/utils/notifications.ts` — an uncapped burst trips Resend's rate limit and loses the message |
| Fan-out wall clock | 40s | `EMAIL_FANOUT_BUDGET_MS` in the same file — must stay under `maxDuration` with room left for the rest of the request to answer |
| DB connections per instance | 2 (Prisma) + 5 (rate limiter) | `server/utils/prisma.ts`, `server/utils/rateLimit.ts` |

The connection budget matters because `DATABASE_URL` uses the Supabase **session** pooler,
which pins one Postgres backend per connection instead of multiplexing, and that project
reports `max_connections = 60`. At 7 per instance the same 60 connections carry eight
concurrent instances; the previous `pg.Pool` default of 10 meant 15 per instance and only
four, after which every request failed at once with `P2024` → 503 `SERVICE_BUSY`.

## Storage buckets

Organizer avatars live in a **Supabase Storage** bucket, and nothing in this repository
creates it. Buckets are rows in the `storage` schema, outside `public` — which is all Prisma
manages — so no migration can produce one and `prisma migrate deploy` never will. On a
freshly provisioned project this is the one thing that is missing while every automated
check is green: the deploy succeeds, `configValidation` reports all variables present, and
the first avatar upload answers `500 INTERNAL`.

Create it once per project. The default name is `organizer-avatars`
(`DEFAULT_ORGANIZER_AVATARS_BUCKET` in `server/utils/config.ts`); if you name it something
else, set `STORAGE_BUCKET_ORGANIZER_AVATARS` to match. That value is resolved at request
time, so renaming is a restart and not a rebuild — but see the warning at the end.

| Property | Value | Why it matters |
|----------|-------|----------------|
| `public` | **`true`** | `avatar.post.ts` stores the result of `getPublicUrl()`, an **unsigned** URL, in `OrganizerProfile.avatarUrl` and serves it to anonymous visitors. An unsigned URL only resolves against a public bucket: a private one uploads successfully and then 400s on every `<img>` |
| SELECT policy on `storage.objects` for role `public` | `USING (bucket_id = '<bucket>')` | The public flag is what the storage API checks; the policy is what Postgres checks when the anonymous GET lands on `storage.objects`. Without it the image 401s |
| `file_size_limit` | `4194304` (optional) | Mirrors the handler's own 4 MiB check one layer earlier, so an oversized file is refused before it is streamed to the server |
| `allowed_mime_types` | `{image/jpeg,image/png,image/webp}` (optional) | Same idea. Not sufficient on its own — the handler validates magic bytes, because a declared type is client-controlled |

Writes are gated by neither setting: the handler uploads and deletes through the
**service-role** client, which bypasses RLS on `storage.objects`. Only reads are, and those
come straight from the browser with no session.

Both the dashboard (**Storage → New bucket → Public bucket**) and the SQL editor work. The
SQL below reproduces exactly what the live project has:

```sql
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'organizer-avatars', 'organizer-avatars', true, 4194304,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET public = true;

CREATE POLICY "organizer-avatars-public-read" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'organizer-avatars');
```

Verify from the SQL editor before deploying:

```sql
SELECT id, public, file_size_limit, allowed_mime_types FROM storage.buckets;
SELECT policyname, cmd, roles, qual FROM pg_policies WHERE schemaname = 'storage';
```

> **Renaming a bucket orphans the avatars already stored.** `avatarUrl` is saved as an
> absolute public URL, and deleting the previous avatar works by splitting that URL on
> `/<bucket>/`. Change the name and the split finds nothing, so the old blob is left behind
> forever and `avatarUrl` still points at a bucket that may no longer exist. Treat the bucket
> name as permanent; if you must rename it, migrate the objects **and** rewrite
> `OrganizerProfile.avatarUrl` in the same change.

Objects are also outside the Prisma schema, so
[`scripts/cleanup-test-data.sql`](#removing-test-data-before-launch) reports the avatar names
of the accounts it deletes but never removes the blobs — see that section.

## Upload size is capped by the platform, not by us

Vercel refuses any request body over **4.5 MB** with `413 FUNCTION_PAYLOAD_TOO_LARGE`, on every
plan, **before the function runs** — there is no `maxBodySize`, no route rule and no config key
that raises it. Anything the app advertises above that number is a promise the deployment
cannot keep: the file clears the browser check in `AvatarUploader.vue` and the handler check in
`avatar.post.ts`, then dies at the edge with a body this client cannot parse, so the uploader
falls back to a generic "upload failed" and the organizer is never told the real reason.

Both limits therefore live in `AVATAR_LIMITS` (`shared/constants/limits.ts`), which the browser
and the handler read as one source of truth:

| Constant | Value | Bounds |
|----------|-------|--------|
| `MAX_FILE_BYTES` | 4 MiB (4194304) | the image |
| `MAX_BODY_BYTES` | 4 MiB + 256 KiB | the whole multipart request, framing included |

`tests/server/api/avatarUpload.test.ts` asserts both stay under 4.5 MB, so raising either
without moving uploads off the function fails a test rather than a user's upload. To actually
support larger images, upload straight to Supabase Storage from the browser with a presigned
URL — that path never enters a Vercel function and is bound only by the bucket's own
`file_size_limit`.

Note the handler's streaming ceiling (`readBodyWithCeiling`) still matters even though the
platform is stricter: it bounds *memory* for a body that is under 4.5 MB but chunked, and it is
the only limit that would survive a move off Vercel.

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
   session is destroyed. That promotion is logged as a warning naming the role it replaced —
   it upgrades somebody's ordinary login, and an operator reading cold-start logs has to be
   able to see that it happened.
4. Two instances cold-starting at once race on the unique email index. The loser catches
   `P2002` and reports the admin as present.

After the first admin exists the variables are ignored — setting them later does not create
a second admin, and rotating `ADMIN_PASSWORD` in the dashboard does not change the account's
password. Remove them from Vercel once the panel is reachable.

`npm run db:seed` reads the same two variables, falling back to `admin@example.com` /
`admin12345` for local development only.

## Removing test data before launch

The production database still holds accounts and groups created while developing: two
organizers (`asd-asd`, `qwe-qwe`), their two `PENDING_REVIEW` groups, four `VISITOR` rows left
by the manual run of 2026-10-05, and 74 `auth.users` identities with no `public."User"` row
behind them. None of it should be visible on launch day.

Run [`scripts/cleanup-test-data.sql`](../scripts/cleanup-test-data.sql) before the first public
deploy:

```bash
psql "$DATABASE_URL" -f scripts/cleanup-test-data.sql
```

It also runs in the Supabase SQL Editor. Two things to know before you do:

- **It refuses to start until you edit it.** Step 0 compares a local `confirm` variable
  against `DELETE-TEST-DATA-2026-11-02`; anything else raises and nothing is touched. There is
  no flag to pass, so an accidental run is impossible.
- **Read the NOTICEs before committing.** The script prints the exact users, profiles and
  groups it is about to delete, the cascade counts, and the resulting row counts. It ends in
  `COMMIT;` — replace that line with `ROLLBACK;` to rehearse it, which is how it was validated.

What it removes, and the two non-obvious reasons it is written the way it is:

| Step | Why it is not simpler |
|------|----------------------|
| Groups are deleted explicitly, before their profile | `Group.organizerId` is `ON DELETE SET NULL`, not `CASCADE`. Deleting the profile first would leave the groups behind with no author — still publicly listed if any were `PUBLISHED` |
| `auth.users` orphans are scoped by "has no `public."User"` row", never by email pattern | Only 64 of the 74 orphans match `%test.com`; the other ten are `@qwe.com`, `@asd.com`, `@example.com` and similar. A pattern would have left them, and a pattern is also how a real customer at `something@test.com` would eventually get deleted |
| `auth.users` is cleaned *after* the public rows | Leaving an auth identity behind lets that address sign in again: `getUser()` auto-provisions a fresh `VISITOR` row on the next request, so the test account comes back |

It never touches an `ADMIN` row in either schema — step 1 aborts rather than delete one — nor
`_prisma_migrations`. There are no counters to reset: every primary key is a `cuid()` string
and `pg_class` reports zero sequences owned by a public table.

**Avatar blobs are not deleted.** Two `storage.objects` rows belong to the removed organizers
and six more match no current user. Deleting the metadata row alone orphans the blob in the
underlying store, so remove them through the Storage API or the dashboard; the object names are
listed in step 6 of the script.

Validated by dry run on 2026-11-02: run end-to-end inside a transaction that was rolled back,
producing `User = 1` (the ADMIN), `OrganizerProfile = 1`, `Group = 2`, `EmailEvent = 6`,
`auth.users = 1`, with all row counts unchanged afterwards.

## Post-Deployment Checklist

- [ ] Config validation plugin logs "All required env variables are set"
- [ ] `/admin` is reachable with `ADMIN_EMAIL`. On an empty database the function logs also
      show `[bootstrap] created the first ADMIN`; a database that already has one logs
      nothing at all. `[bootstrap] promoted existing account … to ADMIN (was ORGANIZER)`
      means an **existing** account was given ADMIN — expected only when you pointed
      `ADMIN_EMAIL` at somebody who had already registered
- [ ] Homepage loads in both `/ua` and `/en`
- [ ] Auth flow works (register, login, logout)
- [ ] Google sign-in completes successfully — it lands on `/<locale>/auth/callback` and not
      on the site root or on `http://localhost:3000`, which is what a missing
      [Redirect URL](#pre-deployment-checklist) looks like
- [ ] Group catalog loads with filters
- [ ] Application form submits successfully
- [ ] An organizer can upload an avatar **and the image then loads in a private window** — the
      upload alone only proves the service-role write, while the private window is what tests
      the bucket's public flag and its SELECT policy ([Storage buckets](#storage-buckets))
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
| Source maps | **Disabled** | Disabled |
| DevTools | Enabled | Disabled |
| Config validation | Warns on optional and on the mail trio | Throws on missing required, mail included |
| Email delivery | `DEV_PREVIEW` row, no provider call | Real send through Resend |
| HSTS | `max-age=300` (header is meaningless over HTTP anyway) | `max-age=300` until the rollout raises it |
| First-admin bootstrap | Same code path; usually a noop because the seed created one | Creates the only ADMIN on an empty database |

Source maps are the one row with no dev/prod split: `nuxt.config.ts` sets
`sourcemap: { server: false, client: false }` unconditionally, so they are off in development
too and a server stack trace points at generated Nitro chunks rather than at the source. That
is a deliberate trade — nothing may ship a map to production — but it is a knob, not a law:
Nuxt resolves `nuxt.config.ts` with `dev` already known, so
`sourcemap: { server: Boolean(process.env.NODE_ENV !== 'production'), client: false }` would
restore dev traces while keeping production bare.
