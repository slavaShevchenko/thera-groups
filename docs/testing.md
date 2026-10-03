# Testing

## Framework

- **Vitest** — unit, shared, server, and integration tests
- **Playwright** — e2e tests against a real Chromium and the Nuxt dev server

## Test Structure

```
tests/
├── unit/           — Pure function tests (services with mocked Prisma)
│   ├── groupService.test.ts
│   ├── applicationService.test.ts
│   ├── slugify.test.ts
│   └── server-i18n.test.ts
├── shared/         — Shared utility tests
│   ├── permissions.test.ts
│   └── groupTypes.test.ts
├── server/         — Server utility and API handler tests
│   ├── auth.test.ts
│   ├── rateLimit.test.ts
│   ├── organizerService.test.ts
│   └── api/
│       ├── auth.test.ts
│       └── groups.test.ts
├── integration/    — Real database tests (require TEST_DATABASE_URL)
│   ├── groups-flow.test.ts
│   ├── applications-flow.test.ts
│   ├── rls.test.ts
│   └── cascade-deletes.test.ts
├── e2e/            — Playwright specs (run separately, not part of vitest)
│   ├── auth.spec.ts
│   ├── catalog.spec.ts
│   ├── navigation.spec.ts
│   ├── organizers.spec.ts
│   ├── groups.spec.ts        — skipped without E2E_ORGANIZER_* credentials
│   └── helpers/
│       ├── fixtures.ts       — `test`/`expect` with the hydration wait
│       ├── text.ts           — t()/tEn() over the real locale bundles
│       ├── auth.ts           — loginAsOrganizer()
│       ├── env.ts            — optional e2e environment variables
│       ├── locale.ts         — setLocaleCookie()
│       └── network.ts        — stubGroupWrites()
└── setup.ts        — Global test setup (mock Prisma, h3 globals)
```

`vitest.config.ts` only collects `*.test.ts` under unit/shared/server/integration, so
Playwright specs never run under Vitest and `tests/setup.ts` never applies to them.

## Commands

```bash
# Run all tests (watch mode)
npm run test

# Run all tests once
npm run test:run

# Run with coverage
npm run test:coverage

# Run integration tests only
npm run test:integration

# Run e2e tests in Chromium (starts the dev server if port 3000 is free)
npm run test:e2e

# Interactive Playwright UI
npm run test:e2e:ui

# Serve the HTML report of the last e2e run
npm run test:e2e:report
```

## Coverage Thresholds

| Metric | Threshold |
|--------|-----------|
| Statements | 50% |
| Branches | 40% |
| Functions | 50% |
| Lines | 50% |

Coverage includes: `server/**/*.ts`, `shared/**/*.ts`, `app/composables/**/*.ts`, `app/utils/**/*.ts`

Excludes: `server/routes/**`, `**/*.test.ts`, `**/*.d.ts`, `server/plugins/**`

## Test Setup (`tests/setup.ts`)

The setup file:
1. Polyfills h3 globals (`createError`, `defineEventHandler`, `readBody`, `getQuery`, `getRouterParam`)
2. Creates a mock Prisma client with all model methods as `vi.fn()`
3. Mocks `~~/server/utils/prisma` to return the mock

## Unit Tests

Test services with mocked Prisma. Example pattern:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('groupService', () => {
  it('throws NotFoundError when group does not exist', async () => {
    ;(prisma.group.findUnique as any).mockResolvedValue(null)
    await expect(groupService.getGroupBySlug('missing'))
      .rejects.toThrow('Group not found')
  })
})
```

## Integration Tests

Integration tests require a real database connection:

```bash
# Set TEST_DATABASE_URL to a separate test database
TEST_DATABASE_URL=postgresql://... npm run test:integration
```

**Never run integration tests against the production database.**

Integration tests verify:
- Full flow (create → moderate → publish group)
- Application lifecycle (apply → approve → capacity)
- RLS policies
- Cascade deletes

## E2E Tests (Playwright)

Chromium only, on purpose — one browser keeps the suite fast and `npx playwright install
chromium` is the whole setup. (`npx playwright install-deps` is Linux-only; macOS needs
nothing beyond the browser download.)

### Configuration

`playwright.config.ts`:

- `testDir: ./tests/e2e`, `testMatch: **/*.spec.ts` — helpers are never collected as tests
- `webServer` runs `npm run dev` and **reuses an already-running server on port 3000**
  outside CI. Never start a second dev server by hand: both write to `.nuxt/`.
- `workers: 2` locally, `1` in CI. Nuxt dev compiles each route on first request, so a
  wide worker pool just makes every worker wait on the same cold build.
- `timeout: 120s`, `expect.timeout: 15s`, `navigationTimeout: 90s` — sized for cold
  dev-server compiles, not for production latency.
- Reporters: `list` (console) + `html` with `open: 'never'` so a failed run does not
  spawn a report server and hang the terminal.
- Artifacts land in `test-results/` and `playwright-report/`, both git-ignored.

### Always import `test` and `expect` from the fixture

```ts
import { expect, test } from './helpers/fixtures'   // not '@playwright/test'
```

`helpers/fixtures.ts` wraps `page.goto()` and waits for `useNuxtApp().isHydrating === false`.
This is load-bearing: `goto()` resolves on the `load` event, which in dev fires *before*
the client entry has been fetched. A click on an SSR-rendered control in that window is
silently dropped because Vue has not attached its listeners yet — the test then fails on
an assertion that looks unrelated (URL never changed, drawer never opened). Importing from
`@playwright/test` directly reintroduces that flake.

### Localization

`app/middleware/locale.global.ts` ranks cookie > URL > default, so a fresh browser context
is bounced from `/en/*` to `/ua/*`. Use the helper for English specs:

```ts
await setLocaleCookie(context, 'en')
await page.goto('/en/catalog')
```

Assert copy through `helpers/text.ts` (`t()` / `tEn()`), which reads the real
`app/locales/*.json` bundles, so specs follow translation changes instead of hardcoding
Ukrainian strings.

### Database safety

E2E specs run against whatever `DATABASE_URL` points at — normally the shared remote
Supabase database. Therefore:

- The default suite is **read-only**: catalog filters, organizers search, navigation,
  locale handling, login-page validation, anonymous route guards.
- `auth.spec.ts` performs exactly one failed login against Supabase Auth with a
  nonexistent address. Rate limiting is disabled in dev (`import.meta.dev`).
- `groups.spec.ts` is **skipped** unless `E2E_ORGANIZER_EMAIL`, `E2E_ORGANIZER_PASSWORD`
  and `E2E_GROUP_SLUG` are all set. Even then `helpers/network.ts` stubs every non-GET
  `/api/groups/**` request, so the debounced autosave in `useGroupForm` can never write.
  The validation specs additionally assert `stub.calls` is empty, which proves the client
  blocked the autosave rather than the stub hiding it.

| Variable | Purpose |
|----------|---------|
| `E2E_BASE_URL` | Override `http://localhost:<E2E_PORT>` |
| `E2E_ORGANIZER_EMAIL` / `E2E_ORGANIZER_PASSWORD` | Sign in for `groups.spec.ts` |
| `E2E_GROUP_SLUG` | Draft group that organizer may edit |
| `E2E_COORGANIZER_QUERY` | Search term matching ≥ 2 organizers (default `а`) |

### Adding a spec

1. Create `tests/e2e/<feature>.spec.ts` and import `test`/`expect` from `./helpers/fixtures`.
2. Prefer role/label locators; scope with a BEM class when a name is ambiguous — the footer
   repeats header links, and `useHead` renders its own `role="status"` live region.
3. Keep it read-only, or gate it behind env vars and stub the writes.
4. `npm run test:e2e` must pass from a cold start, not only against a warm dev server.

### Known limits

- `showPicker()` opens a native popup that cannot be driven headlessly. Specs only cover
  the handler's catch/focus fallback, not the calendar itself.
- No visual-regression or mobile-viewport projects yet; only `Desktop Chrome`.
- `/ua/admin` is not in the anonymous-guard list: its watcher waits for a resolved user, so
  an anonymous visitor is never redirected. Server APIs still enforce `admin.panel`.

## Writing New Tests

1. Place in the appropriate directory (unit/shared/server/integration/e2e)
2. Use `vi.clearAllMocks()` in `beforeEach`
3. For services: mock Prisma methods, test domain error throws
4. For API handlers: mock auth, test HTTP status codes
5. For integration: use real Prisma client, clean up after tests
6. For e2e: import `test`/`expect` from `./helpers/fixtures`, stay read-only or stub writes
