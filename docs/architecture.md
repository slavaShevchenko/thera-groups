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
  → mapDomainError() / toDomainHttpError() converts to H3Error:
    NotFoundError    → 404 { code: 'NOT_FOUND' }
    ForbiddenError   → 403 { code: 'FORBIDDEN' }
    ConflictError    → 409 { code: 'CONFLICT' }
    ValidationError  → 400 { code: 'VALIDATION_FAILED', field? }
    The statusMessage becomes a fixed English phrase per code and the service's own message
    moves to `cause`, where the log reads it: a service message is never localized and can
    quote user input back, so it must not reach a browser
  → sanitizeError() in catch blocks:
    Trusted codes → pass through, except INTERNAL, whose statusMessage is stripped
    Unknown codes → 500 { code: 'INTERNAL' }
    The handler's own status is kept either way — the body is what goes generic
  → mapPrismaError() for raw Prisma errors:
    P2002 (unique violation) → 409 { code: 'CONFLICT', field }
    P2025 (not found)        → 404 { code: 'NOT_FOUND' }
    P2003 (FK violation)     → 400 { code: 'VALIDATION_FAILED' }
    P2014 (required relation) → 400 { code: 'VALIDATION_FAILED' }
    P1001 P1002 P1003 P5003  → 503 { code: 'DATABASE_UNAVAILABLE' }
    P2024 (pool timeout)     → 503 { code: 'SERVICE_BUSY' }
    P2021 P2022 P2023 (drift) → 500 { code: 'INTERNAL' }
    any other P####          → 500 { code: 'INTERNAL' }
```

### Domain Errors (`server/utils/domainErrors.ts`)

| Class | Code | HTTP |
|-------|------|------|
| `NotFoundError` | `NOT_FOUND` | 404 |
| `ForbiddenError` | `FORBIDDEN` | 403 |
| `ConflictError` | `CONFLICT` | 409 |
| `ValidationError` | `VALIDATION_FAILED` | 400 |
| `GroupFullError` | `GROUP_FULL` | 409 |
| `GroupEndedError` | `GROUP_ENDED` | 409 |
| `HasApplicationsError` | `HAS_APPLICATIONS` | 409 |

All extend `DomainError` which carries a `code` string. The three domain 409s exist because a
single generic `CONFLICT` cannot tell an applicant "no seats left" from "the group already
ran", nor an organizer "people are waiting on this group" from a plain refusal — clients branch
on the code to pick their message.

### What the client renders

`data.code` is the whole contract. A caller reads the code and looks its own wording up in
`app/locales/*.json`; it never prints `statusMessage`, which is an English diagnostic.

`app/error.vue`, the full-page surface, follows the same rule: `data.code` → an i18n key →
`statusCode` → `errors.generic`. It ignores `statusMessage` entirely, because three unrelated
sources write to it — Nuxt's router (`Page not found: <path>`, which would echo the requested
URL back at the reader), the sanitizer (a fixed phrase, by design), and pages that hardcode
English. A page that wants specific full-page copy names a code instead, the way
`organizers/[slug].vue` throws `data: { code: 'ORGANIZER_NOT_FOUND' }`. A reason that needs to
appear *inside* a working page is rendered inline there, not thrown.

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

Every caller **awaits** it. There used to be a `sendEmailFireAndForget()` wrapper that
detached the promise so a notification write would not wait on a provider round-trip; on
Vercel that silently dropped mail, because Nitro's Vercel runtime is a plain `toNodeListener`
with no background-work hook and `event.context.waitUntil` is never populated there. Nothing
kept the instance alive past the response. The wrapper is deleted rather than deprecated, so
a new call site cannot bring it back.

Three things keep the awaited round-trip bounded: `transport.ts` caps each attempt and gives up
after three; the fan-outs in `server/utils/notifications.ts` send at `EMAIL_CONCURRENCY` (3) at
a time; and `EMAIL_FANOUT_BUDGET_MS` (40s) in the same file stops a fan-out before it can run
into the ceiling, always after at least one batch. `nuxt.config.ts` raises that ceiling to
`maxDuration: 60` — see [`deployment.md`](./deployment.md#function-duration-and-mail).

The budget exists because being *killed* at the ceiling is worse than stopping early: a letter
whose batch never started never called `sendEmail`, so it leaves no `EmailEvent` row either,
and the organizer is handed a 5xx for a transition that committed. Recipients a budget cuts off
are named in a `console.error` line, which is the only record they have.

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
