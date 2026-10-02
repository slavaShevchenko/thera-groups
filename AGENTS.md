# AGENTS.md — Project Engineering Contract

## 1. Project Overview

**Psychotherapy Groups Catalog** — bilingual (UA/EN) platform where organizers create psychotherapy group events and visitors discover groups and submit applications without registration.

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

### What Is Forbidden

| Forbidden | Alternative |
|-----------|-------------|
| Prisma imports in `app/` | Use `useFetch`/`useAsyncData` to call server API |
| `raw fetch()` | Use `$fetch` / `useFetch` / `useAsyncData` |
| Hardcoded UI strings | Use `t()` from `useLocale()` |
| Hex colors in components | Use CSS variables from `variables.css` |
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
- Priority: cookie > URL > default (`ua`)
- All UI text via `t()` from `useLocale()` composable
- `ua.json` and `en.json` must have identical key structure
- Server notifications via `server/i18n/index.ts` `t(key, locale, params)`
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
  → sanitizeError() in catch: trusted codes pass through, unknown → 500 INTERNAL
  → mapPrismaError() for raw Prisma: P2002→409, P2025→404, P2003/P2014→400
```

### Trusted Error Codes (client-visible)

`VALIDATION_FAILED`, `NOT_FOUND`, `UNAUTHORIZED`, `FORBIDDEN`, `CONFLICT`, `RATE_LIMITED`, `INTERNAL`

All other errors are sanitized to `{ code: 'INTERNAL' }` with 500 status.

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
| `application.manage` | ADMIN or group owner |
| `admin.*` | ADMIN only |

Full list: [`docs/permissions.md`](./docs/permissions.md)

---

## 6. Security Rules

| Concern | Implementation |
|---------|---------------|
| CSP | `server/plugins/csp.ts` — strict in prod, relaxed in dev |
| HTTP headers | `nuxt.config.ts` routeRules: X-Frame-Options, HSTS, etc. |
| Rate limiting | Postgres-backed via `rate-limiter-flexible`, disabled in dev |
| Error sanitization | `sanitizeError()` whitelists trusted codes |
| File upload | Magic bytes validation (JPEG/PNG/WebP) + size limit |
| Auth | `requireAuth()`, `requireRole()`, `can()` — always server-side |
| Session | Supabase JWT, never trust client-supplied user/org IDs |
| Sensitive data | Never log application contents, never include answers in emails |

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
npm run test:run      # single run
npm run test:coverage # with coverage
npm run test:integration # requires TEST_DATABASE_URL
```

### Coverage Thresholds

| Metric | Threshold |
|--------|-----------|
| Statements | 50% |
| Branches | 40% |
| Functions | 50% |
| Lines | 50% |

### Rules

- Unit tests: mock Prisma, test domain error throws
- Integration tests: require `TEST_DATABASE_URL`, never run against production
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
- RLS enabled on all tables
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
DRAFT → PENDING_REVIEW → PUBLISHED → FULL → COMPLETED
              ↓               ↓
           REJECTED       CANCELLED
              ↓
         PENDING_REVIEW (re-submit)
```

### Application Lifecycle

```
PENDING → APPROVED | REJECTED | WITHDRAWN
```

- WITHDRAWN only from PENDING, by applicant only
- Approved count reaching capacity → group auto-transitions to FULL
- Duplicate prevention: unique `[groupId, email]`

### Verification Flow

```
UNVERIFIED → PENDING → VERIFIED / REJECTED
```

- Only VERIFIED organizers can create groups
- Rejection requires reason

### Key Rules

- Critical field changes on PUBLISHED groups → auto-revert to PENDING_REVIEW
- Cannot modify questions after applications exist
- Co-organizers can edit but not change status or manage co-organizers
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
├── api/              — Thin HTTP handlers
├── services/         — Business logic (groupService, applicationService, organizerService)
├── repositories/     — Prisma data access
├── validators/       — Zod schemas (auth, group, application, organizerProfile, query)
├── utils/            — prisma, auth, domainErrors, mapDomainError, errorHandler,
│                       rateLimit, permissions, notifications, fileValidation, etc.
├── middleware/        — rateLimit.global.ts
├── plugins/          — configValidation, csp, errorHandler
└── i18n/             — Server-side notification translations

shared/
├── constants/        — limits, statusColors, locales, groupTypes
└── utils/            — permissions.ts (can() function), notificationRoutes.ts, groupTypeSlug.ts

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
├── integration/      — Real DB tests (require TEST_DATABASE_URL)
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
