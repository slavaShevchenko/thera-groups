# Configuration

## Environment Variables

### Required (Private)

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-only) |
| `SUPABASE_ANON_KEY` | Supabase anonymous key |

### Required (Public)

| Variable | Description |
|----------|-------------|
| `SUPABASE_URL` | Supabase project URL |
| `SITE_URL` | Public site URL (must be https in production, not localhost) |
| `TRUSTED_PROXY_HOPS` | Trusted proxy hops to the right of the client in `x-forwarded-for`; `0` for Vercel. Unset falls back to skipping reserved addresses. See [`security.md`](./security.md) |

### Optional (Private)

| Variable | Description |
|----------|-------------|
| `RESEND_API_KEY` | Resend API key for email sending |
| `EMAIL_FROM` | Sender email address |
| `EMAIL_FORCE_SEND` | `true` delivers real mail from `nuxt dev`; otherwise dev stores a `DEV_PREVIEW` row |
| `RESEND_WEBHOOK_SECRET` | Standard Webhooks secret (`whsec_…`) for `POST /api/webhooks/resend` |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `JWT_SECRET` | JWT signing secret |
| `ADMIN_EMAIL` | First-admin bootstrap; also read by `npm run db:seed` |
| `ADMIN_PASSWORD` | First-admin bootstrap; also read by `npm run db:seed` |

`ADMIN_EMAIL` and `ADMIN_PASSWORD` are used **only** while the database has zero `ADMIN`
rows — see [`deployment.md`](./deployment.md#first-admin-bootstrap). Once one exists,
`server/plugins/adminBootstrap.ts` stops after a single `SELECT` and both are ignored.
They are optional in `configValidation.ts` on purpose: a local dev without them must still
start.

`RESEND_API_KEY`, `EMAIL_FROM` and `SITE_URL` are also mirrored into `runtimeConfig` and
reported by `server/plugins/configValidation.ts`. The email service
(`server/services/email/transport.ts`) and the Resend webhook read `process.env` directly
instead: neither has a request context, and it keeps their unit tests free of a Nuxt
runtime — the same reason `server/utils/rateLimit.ts` reads `DATABASE_URL` from the
environment.

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
- `Strict-Transport-Security: max-age=31536000; includeSubDomains`

### Route Rules

- `/` redirects to `/ua`
- Source maps disabled in build

### Runtime Config

Private (server-only):
- `databaseUrl`, `supabaseServiceRoleKey`, `supabaseAnonKey`
- `resendApiKey`, `emailFrom`
- `googleClientId`, `googleClientSecret`, `jwtSecret`

Public (accessible client-side):
- `siteUrl`, `supabaseUrl`

## Prisma Config (`prisma.config.ts`)

- Schema: `database/schema.prisma`
- Uses `dotenv` for env loading
- Datasource URL from `DATABASE_URL`
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
