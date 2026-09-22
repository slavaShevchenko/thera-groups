# Testing

## Framework

- **Vitest** — unit, shared, server, and integration tests
- **Playwright** — e2e tests (configured but not yet in use)

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
└── setup.ts        — Global test setup (mock Prisma, h3 globals)
```

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

## Writing New Tests

1. Place in the appropriate directory (unit/shared/server/integration)
2. Use `vi.clearAllMocks()` in `beforeEach`
3. For services: mock Prisma methods, test domain error throws
4. For API handlers: mock auth, test HTTP status codes
5. For integration: use real Prisma client, clean up after tests
