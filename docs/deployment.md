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

4. **Build Command**: `npm run build` (default for Nuxt)

5. **Node Version**: Ensure `^22.19.0 || ^24.11.0 || >=26.0.0`

## Post-Deployment Checklist

- [ ] Config validation plugin logs "All required env variables are set"
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
