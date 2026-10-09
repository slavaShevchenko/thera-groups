# Architecture

## Layered Architecture

```
app/pages/[locale]/
  ↓
app/components/ (ui/, features/, sections/, layout/)
  ↓
app/composables/ (useLocale, useCanCreateGroups, useUnreadCount)
  ↓
useFetch / useAsyncData (Nuxt data-fetching)
  ↓
server/api/ (thin HTTP handlers)
  ↓
server/services/ (business logic, domain errors)
  ↓
server/repositories/ (data access, Prisma queries)
  ↓
server/utils/prisma.ts (Prisma client singleton)
  ↓
PostgreSQL (Supabase)
```

### Rules

- **UI must not contain business logic.** Components render data and emit user intent.
- **Prisma imports only in `server/`**. ESLint blocks `~~/server/utils/prisma` from `app/`.
- **Services throw domain errors.** Handlers catch them via `mapDomainError()`.
- **Repositories are the single point of Prisma access.** Services never call `prisma.*` directly for queries (only for `$transaction`).
- **`shared/` is safe for both client and server.** No Node.js imports, no Prisma.

## Data Flow

```
Client request
  → server/middleware/rateLimit.global.ts (global rate limit)
  → server/api/*.ts (handler: validate input, call requireAuth/requirePermission)
  → server/services/*.ts (business logic, throw domain errors)
  → server/repositories/*.ts (Prisma queries)
  → PostgreSQL
  → Response (or error via mapDomainError)
```

## Error Handling Flow

```
Service throws domain error
  → mapDomainError() converts to H3Error:
    NotFoundError    → 404 { code: 'NOT_FOUND' }
    ForbiddenError   → 403 { code: 'FORBIDDEN' }
    ConflictError    → 409 { code: 'CONFLICT' }
    ValidationError  → 400 { code: 'VALIDATION_FAILED', field? }
  → sanitizeError() in catch blocks:
    Trusted codes (VALIDATION_FAILED, NOT_FOUND, UNAUTHORIZED, FORBIDDEN, CONFLICT, RATE_LIMITED) → pass through
    Unknown codes → 500 { code: 'INTERNAL' }
  → mapPrismaError() for raw Prisma errors:
    P2002 (unique violation) → 409 { code: 'CONFLICT', field }
    P2025 (not found)        → 404 { code: 'NOT_FOUND' }
    P2003 (FK violation)     → 400 { code: 'VALIDATION_FAILED' }
    P2014 (required relation) → 400 { code: 'VALIDATION_FAILED' }
```

### Domain Errors (`server/utils/domainErrors.ts`)

| Class | Code | HTTP |
|-------|------|------|
| `NotFoundError` | `NOT_FOUND` | 404 |
| `ForbiddenError` | `FORBIDDEN` | 403 |
| `ConflictError` | `CONFLICT` | 409 |
| `ValidationError` | `VALIDATION_FAILED` | 400 |

All extend `DomainError` which carries a `code` string.

## Rate Limiting

Postgres-backed via `rate-limiter-flexible` using the `rate_limits` table.

| Limiter | Points | Window | Usage |
|---------|--------|--------|-------|
| `globalLimiter` | 100 | 60s | All API routes (middleware) |
| `authLimiter` | 5 | 15min | Login |
| `registerLimiter` | 3 | 60min | Registration |
| `applicationLimiter` | 10 | 15min | Application submit |
| `uploadLimiter` | 10 | 60min | File uploads |

Disabled in development (`import.meta.dev` check).

## Permissions System

`shared/utils/permissions.ts` exports `can(permission, user, resource?)`.

- Type-safe: `Permission = keyof typeof permissions`
- Resource-based: `isOwner()`, `isOwnerOrCoOrganizer()` helpers
- Server wraps in `requirePermission()` (`server/utils/permissions.ts`)

See [permissions.md](./permissions.md) for full key list.

## Security Headers

- **CSP** (`server/plugins/csp.ts`): Strict policy for production, relaxed for dev (HMR, eval)
- **HTTP headers** (`nuxt.config.ts` routeRules): X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy, HSTS
- **File validation** (`server/utils/fileValidation.ts`): Magic bytes check for JPEG/PNG/WebP

## Server Plugins

| Plugin | Purpose |
|--------|---------|
| `configValidation.ts` | Validates required env vars on startup |
| `csp.ts` | Injects Content-Security-Policy header |
| `errorHandler.ts` | Logs unhandled errors with path context |

## Server-Side i18n

`server/i18n/index.ts` provides two lookups:

| Function | Returns | Dictionary |
|----------|---------|------------|
| `t(key, locale, params)` | `{ subject, body }` for in-app notifications | `server/i18n/notifications/{ua,en}.ts` |
| `tEmail(key, locale, params)` | a single string for email copy | `server/i18n/email/{ua,en}.ts` |

Both interpolate `{param}` tokens and fall back to the key itself when a translation is
missing. They never fall back to the other locale, so a parity gap shows up as a raw key
instead of silently mixing languages. `tests/server/email/localeParity.test.ts` asserts the
two dictionaries have identical key sets.

Email copy lives server-side rather than in `app/locales/*.json` because `useLocale()`
imports those files whole into the client bundle — ~150 strings a visitor never sees.

## Email Service

`server/services/email/` is the only place that renders or sends mail. Everything else
calls one function:

```ts
import { sendEmail } from '~~/server/services/email'

await sendEmail({
  to: 'organizer@example.com',
  template: 'application_approved',
  locale: 'ua',
  data: { groupTitle, groupSlug },
})
```

`sendEmailFireAndForget()` wraps the same call without awaiting it — that is what the
`notify*` helpers in `server/utils/notifications.ts` use, because a notification write must
not wait on a provider round-trip.

| File | Responsibility |
|------|----------------|
| `index.ts` | Single entry point: render → track → deliver → persist. Never throws into the caller |
| `types.ts` | `EmailTemplate` union, `TemplateDataMap`, `SendEmailOptions<T>` |
| `registry.ts` | Template → entry lookup, and the documented `NotificationType`s with no email |
| `renderer.ts` | Base layout (preheader, header, footer, unsubscribe, address) + HTML escaping helpers |
| `transport.ts` | Resend config resolution, dev short-circuit, retry with backoff and per-attempt timeout |
| `tracking.ts` | `EmailEvent` writes and error sanitization |
| `templates/*.ts` | One file per template, returning body HTML fragments |

Guarantees worth knowing before you touch it:

- **`sendEmail()` never throws.** Every failure path is caught, written to `EmailEvent` as
  `FAILED` and logged once through `logHandlerError(error, { source: 'email' })`.
- **A missing `RESEND_API_KEY` is `SKIPPED`, not an error**, so local development and
  preview deployments work without credentials.
- **In dev (`import.meta.dev`, no `EMAIL_FORCE_SEND`) nothing is sent.** The rendered HTML
  is stored on the `DEV_PREVIEW` row and `[email] dev preview for <template> to <email>` is
  logged.
- **Retries reuse one `idempotencyKey`**, so Resend deduplicates a message that was
  accepted but whose response timed out.
- **Application answers never enter an email payload** — `TemplateDataMap` has no field for
  them, so the rule is enforced by the type system rather than by discipline.

Delivery status flows `PENDING → SENT`, then `DELIVERED` / `BOUNCED` / `COMPLAINED` when
Resend calls back into `POST /api/webhooks/resend`. `HTML` is only stored on `DEV_PREVIEW`
rows; production rows leave it `NULL`.
