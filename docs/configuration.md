# Configuration

## Environment Variables

### Required (Private)

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-only) |
| `SUPABASE_ANON_KEY` | Supabase anonymous key |

### Required in production (Private)

Optional in dev, fatal at boot in production — see
[`deployment.md`](./deployment.md#mail-is-required-in-production).

| Variable | Description |
|----------|-------------|
| `RESEND_API_KEY` | Resend API key for email sending |
| `EMAIL_FROM` | Sender email address; must be verified on the Resend account |
| `RESEND_WEBHOOK_SECRET` | Standard Webhooks secret (`whsec_…`) for `POST /api/webhooks/resend` |

### Required (Public)

| Variable | Description |
|----------|-------------|
| `SUPABASE_URL` | Supabase project URL |
| `SITE_URL` | Public site URL (must be https in production, not localhost) |
| `TRUSTED_PROXY_HOPS` | Trusted proxy hops to the right of the client in `x-forwarded-for`; `0` for Vercel. Unset falls back to skipping reserved addresses. See [`security.md`](./security.md) |

### Optional (Private)

| Variable | Description |
|----------|-------------|
| `EMAIL_FORCE_SEND` | `true` delivers real mail from `nuxt dev`; otherwise dev stores a `DEV_PREVIEW` row |
| `HSTS_MAX_AGE` | Seconds for `Strict-Transport-Security`. Defaults to `300`; anything not a non-negative integer falls back to that. See [`deployment.md`](./deployment.md#hsts-rollout) |
| `HSTS_INCLUDE_SUBDOMAINS` | `true` appends `; includeSubDomains`. Only after every subdomain has valid TLS |
| `ADMIN_EMAIL` | First-admin bootstrap; also read by `npm run db:seed` |
| `ADMIN_PASSWORD` | First-admin bootstrap; also read by `npm run db:seed` |
| `STORAGE_BUCKET_ORGANIZER_AVATARS` | Supabase Storage bucket holding organizer avatars. Defaults to `organizer-avatars`. Names the bucket only — **nothing in this repo creates it**, so a new project needs it made by hand: [`deployment.md`](./deployment.md#storage-buckets) |

No Google OAuth credential and no JWT signing key is configuration of this application —
an earlier revision of this table listed three such variables and nothing ever read them.
Google sign-in is configured in the Supabase dashboard and proxied through
`/api/auth/google-start`; tokens are issued and verified by Supabase, so nothing here signs
a JWT either.

`ADMIN_EMAIL` and `ADMIN_PASSWORD` are used **only** while the database has zero `ADMIN`
rows — see [`deployment.md`](./deployment.md#first-admin-bootstrap). Once one exists,
`server/plugins/adminBootstrap.ts` stops after a single `SELECT` and both are ignored.

Every private variable also accepts the `NUXT_`-prefixed spelling, which Nitro applies as a
runtime override: `NUXT_RESEND_API_KEY` and `RESEND_API_KEY` both work, and the former wins.
`runtimeConfig` in `nuxt.config.ts` holds empty defaults so no secret is inlined into
`.output`, and `resolveEnvValue()` in `server/utils/config.ts` does the two-step lookup at
request time. Rotating a secret is then a restart, not a rebuild.

The public pair (`SITE_URL`, `SUPABASE_URL`) is resolved at build time instead, because the
client bundle reads the same object and has no environment to fall back to.

Three modules read `process.env` directly rather than through `useServerConfig()`:
`server/services/email/transport.ts`, `server/api/webhooks/resend.post.ts` and
`server/utils/rateLimit.ts`. None of them has a Nuxt request context, and it keeps their unit
tests free of a Nuxt runtime.

### Seed-Only

| Variable | Description |
|----------|-------------|
| `ALLOW_SEED_HOST` | Additional allowed host for seed (e.g. staging DB) |
| `FORCE_SEED` | Skip confirmation prompt (`true`) |
| `CI` | Skip confirmation prompt in CI (`true`) |
| `TEST_DATABASE_URL` | Separate database for integration tests |

`ADMIN_EMAIL` / `ADMIN_PASSWORD` are listed under Optional (Private): the seed reads them
too, falling back to `admin@example.com` / `admin12345` for local development only.

## Nuxt Config (`nuxt.config.ts`)

### Modules

- `@nuxt/eslint` — ESLint integration with stylistic rules

### Components

Auto-imported from `~/components` without path prefix (no `Ui` prefix required in templates).

### CSS

Global stylesheets loaded in order:
1. `~/assets/css/fonts.css` — Font faces (Inter, Lora)
2. `~/assets/css/variables.css` — CSS custom properties, reset, base styles
3. `~/assets/css/animations.css` — Shared animations

### Security Headers (routeRules)

Applied to all routes:
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`
- `Strict-Transport-Security` — built by `buildHstsHeader()` in
  `shared/utils/securityHeaders.ts` from `HSTS_MAX_AGE` / `HSTS_INCLUDE_SUBDOMAINS`.
  Defaults to `max-age=300`: the header cannot be revoked, so it is raised in steps rather
  than shipped at a year on the first deploy. See
  [`deployment.md`](./deployment.md#hsts-rollout).

`server/plugins/responseHeaders.ts` removes the `x-powered-by: Nuxt` header the renderer
adds to every HTML response. `routeRules` cannot do it: the header is applied after them.

### Route Rules

- `/` redirects to `/ua`
- Source maps disabled in build

### Runtime Config

Private (server-only) — all default to an empty string so no secret is inlined into the
build output, and are resolved at request time by `resolveEnvValue()`:
- `databaseUrl`, `supabaseServiceRoleKey`, `supabaseAnonKey`
- `resendApiKey`, `emailFrom`
- `adminEmail`, `adminPassword`

Public (accessible client-side) — resolved at build time, since the client has no
environment to fall back to:
- `siteUrl`, `supabaseUrl`

## Prisma Config (`prisma.config.ts`)

- Schema: `database/schema.prisma`
- Uses `dotenv` for env loading
- Datasource URL from `DATABASE_URL`, and **omitted entirely** when that variable is absent
  so `prisma generate` (which `postinstall` runs) works in a CI job or Preview build with no
  database. Commands that need one then fail with Prisma's own missing-datasource message.
- Seed command: `tsx database/seed.ts`

## ESLint Config (`eslint.config.mjs`)

Key rules:
- `semi: ['error', 'never']` — no semicolons
- `quotes: ['error', 'single']` — single quotes
- `no-console: ['error', { allow: ['warn', 'error'] }]` — no console.log
- `no-unused-vars` — ignore `_` prefixed
- `vue/block-order: ['script', 'template', 'style']`
- `vue/html-self-closing` — void: always, component: always
- `vue/multi-word-component-names: off`
- `vue/no-v-html: warn`
- Restricted imports: Prisma only in `server/` code

## Vitest Config (`vitest.config.ts`)

- Environment: `node`
- Globals: `true`
- Setup files: `tests/setup.ts`
- Coverage provider: `v8`
- Projects: default + integration (filtered by `--project=integration`)

## Package Scripts

| Script | Command |
|--------|---------|
| `dev` | `nuxt dev` |
| `build` | `nuxt build` |
| `generate` | `nuxt generate` |
| `preview` | `nuxt preview` |
| `postinstall` | `prisma generate && nuxt prepare` |
| `lint` | `eslint .` |
| `lint:fix` | `eslint . --fix` |
| `format` | `prettier --write` |
| `test` | `vitest` (watch) |
| `test:run` | `vitest run` |
| `test:coverage` | `vitest run --coverage` |
| `test:integration` | `vitest run --project=integration` |
| `db:seed` | `tsx database/seed.ts` |
