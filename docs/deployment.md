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

3. **Optional Variables**: Configure if needed:
   - `RESEND_API_KEY` + `EMAIL_FROM` (email sending)
   - `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` (Google OAuth)
   - `JWT_SECRET`
   - `ADMIN_EMAIL` + `ADMIN_PASSWORD` (first-admin bootstrap — see below)

4. **Build Command**: `npm run build` (default for Nuxt)

5. **Node Version**: Ensure `^22.19.0 || ^24.11.0 || >=26.0.0`

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
- [ ] Email notifications are sent (check EmailEvent table)
- [ ] Rate limiting is active (not dev mode)
- [ ] CSP headers present in responses
- [ ] HSTS header present

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
| Config validation | Warns on optional | Throws on missing required |
| First-admin bootstrap | Same code path; usually a noop because the seed created one | Creates the only ADMIN on an empty database |
