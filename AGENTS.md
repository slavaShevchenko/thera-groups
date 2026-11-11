# AGENTS.md — Project Engineering Contract

## 1. Project Overview

**PsyGroup** — bilingual (UA/EN) European-wide catalog of psychological events and programs where organizers create events and visitors discover them and submit applications without registration. Covers therapeutic groups, workshops, seminars, lectures, intensives, supervision, educational programs, and other psychological event formats.

- **Framework**: Nuxt 4, Vue 3, Composition API, `<script setup>`, TypeScript
- **Database**: PostgreSQL (Supabase), Prisma 7 with `@prisma/adapter-pg`
- **Auth**: Supabase Auth (JWT)
- **Validation**: Zod (server), client mirrors for UX
- **Email**: Resend
- **Rate Limiting**: `rate-limiter-flexible` (Postgres-backed)
- **Hosting**: Vercel
- **Testing**: Vitest (unit/integration), Playwright (e2e)
- **Styling**: Plain CSS only, BEM, CSS custom properties, `<style scoped>`

Documentation: [`docs/`](./docs/README.md)

---

## 2. Architecture Rules

### Layered Architecture

```
app/pages/[locale]/
  ↓
app/components/ (ui/, features/, sections/, layout/)
  ↓
app/composables/
  ↓
useFetch / useAsyncData
  ↓
server/api/ (thin HTTP handlers)
  ↓
server/services/ (business logic, domain errors)
  ↓
server/repositories/ (data access, Prisma queries)
  ↓
server/utils/prisma.ts (Prisma client)
  ↓
PostgreSQL
```

### Core Rules

- **UI must not contain business logic.** Components render data and emit user intent.
- **Prisma imports only in `server/`**. ESLint blocks `~~/server/utils/prisma` from `app/`.
- **Services throw domain errors.** Handlers catch via `mapDomainError()`.
- **Repositories are the single point of Prisma access.** Services use `prisma` only for `$transaction`.
- **`shared/` is safe for both client and server.** No Node.js imports, no Prisma.
- **API handlers are thin.** Validate → auth → delegate to service → return response.
- **Never duplicate business rules across handlers.** Put them in services.
- **All email goes through `sendEmail()` in `server/services/email/`.** It renders, localizes,
  tracks and delivers, and it never throws into the caller. Resend is imported in
  `server/services/email/transport.ts` and nowhere else.

### What Is Forbidden

| Forbidden | Alternative |
|-----------|-------------|
| Prisma imports in `app/` | Use `useFetch`/`useAsyncData` to call server API |
| `raw fetch()` | Use `$fetch` / `useFetch` / `useAsyncData` |
| Hardcoded UI strings | Use `t()` from `useLocale()` |
| Hex colors in components | Use CSS variables from `variables.css` (email templates are exempt — clients strip `<style>`) |
| `console.log` | `console.warn` and `console.error` only |
| `outline: none` without `:focus-visible` replacement | Always provide visible focus |
| Dead code | Delete unused functions/components |
| Business logic in templates | Move to services/composables |
| CSS frameworks (Tailwind, Bootstrap, etc.) | Plain CSS + BEM |
| CSS-in-JS | Plain CSS + CSS custom properties |
| Axios, jQuery | Built-in Nuxt fetch utilities |

---

## 3. Coding Standards

### JavaScript/TypeScript

- No semicolons
- Single quotes
- camelCase for variables/functions, PascalCase for components, kebab-case for CSS
- Prefer `const`, early returns, small focused functions
- TypeScript strict mode

### Vue Components

Order: `<script setup>` → `<template>` → `<style scoped>`

```vue
<script setup>
// logic
</script>

<template>
  <!-- markup -->
</template>

<style scoped>
/* BEM styles */
</style>
```

### CSS

- BEM naming: `.block__element--modifier`
- CSS variables from `app/assets/css/variables.css`
- Small intentional token set (colors, typography, spacing, radii, shadows, layout)
- `@media (prefers-reduced-motion: reduce)` respected

### Localization

- Path-based: `/ua/...` and `/en/...`
- Priority: cookie > URL > default (`ua`). With no locale cookie a visitor keeps whatever
  locale is in the path, and only a path with *no* locale segment is redirected to `/ua`.
  `locale.global.ts` must never branch on the user agent: `sitemap.xml` advertises an
  `hreflang="en"` alternate for every URL and Google requires an advertised alternate not to
  redirect, so answering `/en/*` for crawlers while sending people to `/ua/*` invalidated the
  whole hreflang set
- The `locale` cookie is written **only** by `setLocale()`. Never pass a `default` to
  `useCookie('locale', …)`: Nuxt materializes a default as a real `Set-Cookie`, so
  `default: () => 'ua'` records a Ukrainian preference on a visitor's very first `/en/*`
  load and bounces them off the English site from the next navigation on
- All UI text via `t()` from `useLocale()` composable
- `ua.json` and `en.json` must have identical key structure
- Server notifications via `server/i18n/index.ts` `t(key, locale, params)`
- Email copy lives in `server/i18n/email/{ua,en}.ts`, read via `tEmail(key, locale, params)` —
  never in `app/locales/*.json`, which `useLocale()` imports whole into the client bundle
- Domain states are language-neutral enums (`PENDING`, not `"Очікує"`)

---

## 4. Error Handling

### Domain Errors (`server/utils/domainErrors.ts`)

| Class | Code | HTTP |
|-------|------|------|
| `NotFoundError` | `NOT_FOUND` | 404 |
| `ForbiddenError` | `FORBIDDEN` | 403 |
| `ConflictError` | `CONFLICT` | 409 |
| `ValidationError` | `VALIDATION_FAILED` | 400 |

### Error Flow

```
Service throws DomainError
  → mapDomainError() → H3Error with trusted code
  → sanitizeError() in catch: logs once, trusted codes pass through, unknown → 500 INTERNAL
  → mapPrismaError() for raw Prisma (pure mapping, never logs)
  → nitro.errorHandler catches whatever no handler caught → mapped response
  → server/plugins/errorHandler.ts (Nitro `error` hook) → the one log line
```

### Prisma Error Mapping (`mapPrismaError`)

| Prisma code | Cause | HTTP | Client code |
|-------------|-------|------|-------------|
| `P2002` | unique constraint | 409 | `CONFLICT` (+ `field`) |
| `P2025` | record not found | 404 | `NOT_FOUND` |
| `P2003` / `P2014` | FK / required relation | 400 | `VALIDATION_FAILED` |
| `P1001` `P1002` `P1003` `P5003` | unreachable, timeout | 503 | `DATABASE_UNAVAILABLE` |
| `P2024` | connection pool timeout | 503 | `SERVICE_BUSY` |
| `P2021` `P2022` `P2023` | schema drift (migration not applied) | 500 | `INTERNAL` |
| any other `P####` | unknown | 500 | `INTERNAL` |

The raw Prisma error is attached as `cause`, so the P-code and its message reach the
logs while the response body stays generic. `nitro.errorHandler`
(`server/utils/nitroErrorHandler.ts`) applies this mapping to `/api/*` requests that no
handler wrapped — it must stay silent, because the Nitro `error` hook already logged.

### Trusted Error Codes (client-visible)

`VALIDATION_FAILED`, `NOT_FOUND`, `UNAUTHORIZED`, `FORBIDDEN`, `CONFLICT`,
`RATE_LIMITED`, `DATABASE_UNAVAILABLE`, `SERVICE_BUSY`, `INTERNAL`,
plus three domain-specific 409s: `GROUP_FULL`, `GROUP_ENDED`, `HAS_APPLICATIONS`

The domain 409s exist because one generic `CONFLICT` cannot tell an applicant "no seats
left" from "the group already ran", nor an organizer "people are still waiting on this
group" from a plain refusal — the client branches on them to pick its message.

All other errors are sanitized to `{ code: 'INTERNAL' }` with 500 status. The whitelist is
`TRUSTED_ERROR_CODES` in `server/utils/errorHandler.ts`.

### Logging

`logHandlerError(error, { source, event? })` writes exactly one line per failure:
`console.warn` for the 4xx a client caused, `console.error` (plus the error object) for
the 5xx we caused. Format `[<source>] <status> <message> path=<path> [prisma=<P-code>]` —
query strings are dropped so OAuth codes never land in logs, multi-line messages are
collapsed to keep one line per error, and a driver failure anywhere in the `cause` chain
contributes its `prisma=` field. `logCapturedError` is the Nitro-hook wrapper
(`source: 'unhandled'`); errors a handler already logged are marked and skipped there, so
nothing is reported twice.

Never `console.error` an expected 4xx yourself — route it through `sanitizeError()` or
`mapPrismaError()` and let the shared logger decide the level.

---

## 5. Permissions System

`shared/utils/permissions.ts` — type-safe `can(permission, user, resource?)`.

Server wrapper: `requirePermission(user, permission, resource)` in `server/utils/permissions.ts`.

### Key Permissions

| Permission | Who |
|-----------|-----|
| `group.create` | ADMIN or ORGANIZER with VERIFIED status |
| `group.edit` | ADMIN, owner, or co-organizer |
| `group.delete` | ADMIN or owner (not co-organizer) |
| `group.publish` / `group.moderate` | ADMIN only |
| `application.create` | Anyone (public) |
| `application.manage` | ADMIN, group owner, or co-organizer |
| `admin.*` | ADMIN only |
| `admin.*.view` | ADMIN — reads a list, and nothing else |
| `admin.*.moderate` | ADMIN — writes. Destructive actions (`admin.organizers.moderate`) must never sit behind a `.view` key |

Full list: [`docs/permissions.md`](./docs/permissions.md)

---

## 6. Security Rules

| Concern | Implementation |
|---------|---------------|
| CSP | `server/plugins/csp.ts` — strict in prod, relaxed in dev. `connect-src` carries only `'self'` and the Iconify origins: nothing else is fetched from the browser |
| HTTP headers | `nuxt.config.ts` routeRules: X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy, HSTS. HSTS starts at `max-age=300` (`buildHstsHeader()` in `shared/utils/securityHeaders.ts`) and is raised in steps — see [`docs/deployment.md`](./docs/deployment.md#hsts-rollout). `server/plugins/responseHeaders.ts` strips `x-powered-by`, which routeRules cannot reach |
| Rate limiting | Postgres-backed via `rate-limiter-flexible`, disabled in dev. Two buckets on credential endpoints: `ip:<addr>` and a hashed per-account one. `x-real-ip` is **never** read. A store failure **fails open** — only a finite, non-negative `msBeforeNext` is a real rejection, and a real 429 sets `Retry-After` — see [`docs/security.md`](./docs/security.md) |
| Boot configuration | `server/plugins/configValidation.ts` throws on any missing required variable. In production that includes `RESEND_API_KEY`, `EMAIL_FROM` and `RESEND_WEBHOOK_SECRET`: a deployment that cannot mail does not start. `SITE_URL` must also be `https://` and not localhost there, because canonical, sitemap and Open Graph URLs are all built from it |
| Secrets | `runtimeConfig` private values default to `''` so nothing is inlined into `.output`. `resolveEnvValue()` in `server/utils/config.ts` reads `NUXT_<KEY>` then the bare name at request time, so rotation is a restart, not a rebuild |
| Error sanitization | `sanitizeError()` whitelists trusted codes. `INTERNAL` is trusted as a *code* only — its statusMessage is stripped, because that is the code a handler uses to name an internal diagnostic. `toDomainHttpError()` likewise puts a fixed phrase per code on the wire and leaves the service's own message on `cause`, where the log reads it |
| File upload | Magic bytes validation (JPEG/PNG/WebP), a **4 MiB** file limit and a whole-body ceiling counted while streaming, both from `AVATAR_LIMITS` in `shared/constants/limits.ts` so the browser and the handler cannot drift. 4 MiB is not our number — Vercel refuses any body over **4.5 MB** with `413 FUNCTION_PAYLOAD_TOO_LARGE` *before the function runs*, on every plan, with no setting that raises it; a limit above that is a promise the deploy cannot keep. The `content-length` pre-check is not sufficient on its own either: a `Transfer-Encoding: chunked` upload carries no such header, and Nitro's `routeRules` have no body-limit key — see `readBodyWithCeiling()` in `server/api/organizers/avatar.post.ts` and [`docs/deployment.md`](./docs/deployment.md#upload-size-is-capped-by-the-platform-not-by-us) |
| Auth | `requireAuth()`, `requirePermission()`, `can()` — always server-side |
| Session | Supabase JWT, never trust client-supplied user/org IDs |
| Email canonicalization | `normalizeEmail()` in `server/utils/emailAddress.ts` — every read and write of an address goes through it; `User.email` is `@unique` byte-for-byte while GoTrue folds case |
| Public reads | Repository `select`, not `include` — an `include` ships `userId`, `organizerId`, `timezone` and `rejectionReason` to anonymous callers. Same rule for identifiers: a profile cuid goes only to callers who can act on it, so `/api/organizers` returns it to an ADMIN and a slug to everybody else |
| Database | **RLS is enabled on every table and filters nothing** — there are no policies, no grants to `anon`/`authenticated`/`service_role`, and the app connects as a `BYPASSRLS` role. The real model is one trusted server role with zero PostgREST exposure. Never cite the flag as an active control; see [`docs/security.md §10`](./docs/security.md#10-database-security-posture) |
| Sensitive data | Never log application contents, never include answers in emails |

Full reasoning per rule: [`docs/security.md`](./docs/security.md)

### Rate Limits

| Limiter | Points | Window |
|---------|--------|--------|
| Global | 100 | 60s |
| Auth (login) | 5 | 15min |
| Registration | 3 | 60min |
| Applications | 10 | 15min |
| Uploads | 10 | 60min |

---

## 7. Testing Rules

### Commands

```bash
npm run test          # watch mode
npm run test:run      # single run (unit + shared + server + integration)
npm run test:coverage # with coverage
npm run test:unit     # unit + shared + server — never touches a database
npm run test:integration # requires TEST_DATABASE_URL, skipped safely without it
npm run test:e2e      # Playwright (Chromium) against the dev server
npm run test:e2e:ui   # Playwright interactive UI
npm run test:e2e:report # serve the last e2e HTML report
```

### Coverage Thresholds

| Metric | Threshold |
|--------|-----------|
| Statements | 55% |
| Branches | 55% |
| Functions | 55% |
| Lines | 55% |

Measured 2026-11-04 at 64.04% statements, 62.6% branches, 63.89% functions, 64.38% lines
(1762 tests). The gate is a ratchet, not a target: raise a threshold only after coverage has
actually climbed past it, and never lower one to make a change pass.

### Rules

- Unit tests: mock Prisma, test domain error throws
- Integration tests: declare every top-level suite with `describeIntegration()` from
  `tests/integration/_guard.ts`, never bare `describe()`. It skips the suite unless
  `TEST_DATABASE_URL` is a `postgresql://` throwaway database that is **not**
  `DATABASE_URL`. There is no fallback, so `npm run test:run` without
  `TEST_DATABASE_URL` issues zero queries anywhere. Never point it at production.
  To run: `TEST_DATABASE_URL=postgresql://... npm run test:integration`
- E2E tests: import `test`/`expect` from `tests/e2e/helpers/fixtures`, never from
  `@playwright/test` — the fixture waits for Nuxt hydration, and clicks dispatched
  before it are silently dropped because Vue has not attached its listeners
- E2E specs hit whatever `DATABASE_URL` points at: keep them read-only, gate
  authenticated flows behind `E2E_ORGANIZER_EMAIL`/`E2E_ORGANIZER_PASSWORD`/`E2E_GROUP_SLUG`
  and stub non-GET `/api/groups/**` calls
- Test setup: `tests/setup.ts` provides mock Prisma + h3 globals
- New business logic should have tests
- Don't write meaningless tests for coverage

---

## 8. Database Rules

- Schema: `database/schema.prisma`
- Migrations: `database/migrations/`
Dev workflow:
- Нові міграції: створюй SQL вручну з timestamp 2026XXXXHHMMSS_description
- Застосування: npx prisma migrate deploy (безпечно, не reset)
- Генерація клієнта: npx prisma generate
- НЕ використовуй migrate dev на спільних БД
- Prod: `npx prisma migrate deploy` (never `migrate dev`)
- CHECK constraints enforce data integrity (price >= 0, capacity > 0, dates, rating 1-5, locale)
- RLS flag is `true` on every table, but there are **no policies and no grants**, and the app
  connects as a `BYPASSRLS` role — it filters nothing. Scoping happens in the repository layer
  and `server/utils/permissions.ts`. See [`docs/security.md §10`](./docs/security.md#10-database-security-posture)
- `Review` and `Report` are reserved and unused — see
  [`docs/database.md`](./docs/database.md#deprecated-tables)
- Seed has safety guards: no prod, localhost only, confirmation prompt

---

## 9. Frontend Rules

### Composables

| Composable | Purpose |
|-----------|---------|
| `useLocale()` | `t()`, `locale`, `setLocale()` |
| `useLocaleHead()` | SEO hreflang tags |
| `useSeoPage()` | One-call SEO setup (title, meta, canonical, OG, JSON-LD) |
| `useUser()` | Auth state, login/register/logout |
| `usePageLoading()` | Global page loading state |
| `usePermissions()` | Vue wrapper for `can()` |
| `useUnreadCount()` | Notification unread count (polls every 30s) |
| `useBreadcrumbs()` | Computed breadcrumb trail |
| `useGroupForm()` | Group edit form with debounced autosave |

### Shared Constants

| File | Contents |
|------|----------|
| `shared/constants/limits.ts` | MAX_QUESTIONS_PER_GROUP (10), MAX_OPTIONS (10), etc. |
| `shared/constants/statusColors.ts` | Status → pill variant mappings |
| `shared/constants/locales.ts` | INTL_LOCALES mapping |
| `shared/constants/groupTypes.ts` | GROUP_TYPES array with value/slug pairs |

### UI Components

| Component | Purpose |
|-----------|---------|
| `UiButton` | Polymorphic (to/href/loading/disabled) |
| `UiEmptyState` | Empty state with CTA |
| `UiConfirmModal` | Confirmation dialog |
| `UiSpinner` | Loading spinner |
| `UiBadge` | Status badge |

### Page Loading

- Use `usePageLoading()` for full-page client-side loading
- Call `startLoading()` before fetch, `finishLoading()` in `finally`
- Never create page-local loading spinners for full-page loads
- Use `forceHide()` before `navigateTo()` redirects

### Error/Empty States

- Load errors: show error UI with Retry button
- Empty lists: use `UiEmptyState` with CTA

---

## 10. Business Logic Quick Reference

### Group Status Transitions

```
DRAFT → PENDING_REVIEW → PUBLISHED ⇄ FULL → COMPLETED (terminal)
              ↓               ↓         ↓
           REJECTED       CANCELLED  CANCELLED
              ↓               ↓
         PENDING_REVIEW  PENDING_REVIEW (admin only)

DRAFT → PUBLISHED (admin only, skips moderation)
```

`validateStatusTransition` in `server/services/groupService.ts` is the source of truth;
`docs/domain-rules.md` carries the reasoning per arrow. Notes that bite:

- The admin-only arrows live in a second table, `ADMIN_ONLY_TRANSITIONS`, because
  `VALID_STATUS_TRANSITIONS` is role-blind — an exception listed there would read as an
  arrow any organizer could take
- `DRAFT → PUBLISHED` is how an admin publishes a group they just created on `/groups/new`.
  The transition check runs **before** the role check, so a missing arrow answers 400
  `VALIDATION_FAILED` even for an ADMIN, not 403
- `FULL` is never a user decision — `applicationService` writes it when the last seat is
  approved and writes `PUBLISHED` back when a rejection or a capacity raise frees one
- `COMPLETED` and `CANCELLED` are reachable by owner **or** admin, from PUBLISHED and
  FULL, and both email the owner plus every APPROVED applicant after commit
- `PUBLISHED`, `FULL` and `COMPLETED` are all publicly visible
  (`PUBLIC_GROUP_STATUSES`); only `PUBLISHED` accepts applications
- `CANCELLED` answers 404, indistinguishable from a slug that never existed

### Application Lifecycle

```
PENDING → APPROVED | REJECTED | WITHDRAWN
REJECTED → PENDING (organizer reverts a wrong rejection)
```

- WITHDRAWN only from PENDING, by applicant only
- REJECTED requires a reason (`ValidationError` → 400 without one); any other decision
  clears `rejectionReason`
- REJECTED → PENDING is the only undo. It moves no seat and notifies nobody — reversing an
  approval goes through REJECTED, which is the transition that frees the seat and can
  reopen FULL
- Approved count reaching capacity → group auto-transitions to FULL
- Approving past capacity → `GROUP_FULL` (409), application row untouched
- Duplicate prevention: unique `[groupId, email]`

### Verification Flow

```
UNVERIFIED → PENDING → VERIFIED / REJECTED
```

- Only VERIFIED organizers can create groups
- Rejection requires reason
- Opening a PENDING profile notifies every admin (`ORGANIZER_PENDING_REVIEW`) — the queue
  surfaces only PENDING rows, so a silent creation leaves the applicant waiting on a
  moderation nobody was told about

### Key Rules

- Critical field changes on PUBLISHED groups → auto-revert to PENDING_REVIEW (the revert
  fires on `PUBLISHED` only — a FULL group is edited without re-entering moderation)
- Cannot modify questions after applications exist
- Co-organizers can edit but not change status or manage co-organizers
- Only DRAFT and REJECTED groups can be deleted, and only while no application is PENDING
  or APPROVED (`HAS_APPLICATIONS`, 409) — `Application.groupId` cascades, so an unguarded
  delete takes every application, answer and question with it silently
- Application answers are sensitive — never log or include in emails

Full details: [`docs/business-logic.md`](./docs/business-logic.md), [`docs/domain-rules.md`](./docs/domain-rules.md)

---

## 11. File Structure

```
app/
├── components/
│   ├── ui/           — Generic reusable primitives (UiButton, UiBadge, etc.)
│   ├── features/     — Domain-specific components (GroupCard, ApplicationForm)
│   ├── sections/     — Page sections composing multiple components
│   └── layout/       — AppHeader, AppFooter, PageLoader
├── composables/      — useLocale, usePageLoading, useCanCreateGroups
├── layouts/          — default.vue
├── middleware/        — locale.global.ts
├── pages/[locale]/   — All pages with locale prefix
├── plugins/
├── stores/
├── assets/css/       — variables.css, fonts.css, animations.css
└── locales/          — ua.json, en.json, seo.ua.json, seo.en.json

server/
├── api/              — Thin HTTP handlers (+ api/webhooks/resend.post.ts)
├── services/         — Business logic (groupService, applicationService, organizerService)
│   └── email/        — index.ts (sendEmail), types, registry, renderer, transport,
│                       tracking, templates/
├── repositories/     — Prisma data access
├── validators/       — Zod schemas (auth, group, application, organizerProfile, query)
├── utils/            — prisma, auth, domainErrors, mapDomainError, errorHandler,
│                       nitroErrorHandler, rateLimit, permissions, notifications,
│                       fileValidation, etc.
├── middleware/        — rateLimit.global.ts
├── plugins/          — configValidation, csp, errorHandler
└── i18n/             — Server-side translations: notifications/{ua,en}.ts, email/{ua,en}.ts

shared/
├── constants/        — limits, statusColors, locales, groupTypes
└── utils/            — permissions.ts (can() function), notificationRoutes.ts

types/
└── index.ts          — All TypeScript interfaces (Group, Application, Organizer, Auth, etc.)

database/
├── schema.prisma     — All models, enums, constraints
├── migrations/       — SQL migration files
└── seed.ts           — Dev seed with safety guards

tests/
├── unit/             — Service tests with mocked Prisma
├── shared/           — Shared utility tests
├── server/           — Server utility and API handler tests
├── integration/      — Real DB tests (skipped unless TEST_DATABASE_URL) + _guard.ts
├── e2e/              — Playwright specs (*.spec.ts) + helpers/ (fixtures, text, auth,
│                       env, locale, network)
└── setup.ts          — Global mock setup

docs/                 — Project documentation (see docs/README.md)
```

---

## 12. Agent Workflow

Before changing code:

1. Read this file
2. Identify relevant `docs/*.md`
3. Inspect existing implementation
4. Search for reusable components/composables
5. Make the smallest safe change
6. Run relevant checks (`npm run lint`, `npm run test:run`)
7. Review the diff

### Never

- Guess missing context — stop and ask
- Invent business rules, API contracts, or database fields
- Rewrite unrelated files
- Add dependencies without justification
- Remove existing imports/composables unless explicitly required
- Overwrite a file when only a small change is needed
- Introduce forbidden frameworks/libraries

### Definition of Done

- Behavior works
- Architecture rules respected
- Localization complete (ua + en)
- Accessibility considered (keyboard, focus, ARIA)
- Loading/error states handled
- Tests updated
- Lint + tests pass
- No forbidden dependencies introduced
- Diff is understandable
