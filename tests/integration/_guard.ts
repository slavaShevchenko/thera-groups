import { describe } from 'vitest'

/**
 * Integration suites open a real PrismaClient against a real database.
 *
 * They used to derive the URL as `TEST_DATABASE_URL || DATABASE_URL`, so with
 * TEST_DATABASE_URL unset — the normal case — `npm run test:run` silently wrote
 * fixtures into the shared Supabase database that AGENTS.md §7 says they must
 * never touch. Skipping is the safe default; there is no fallback any more.
 */
export function testConnectionString(): string | undefined {
  return process.env.TEST_DATABASE_URL
}

/** Why the integration suites must be skipped, or `null` when they may run. */
export function integrationSkipReason(): string | null {
  const url = process.env.TEST_DATABASE_URL

  if (!url) return 'TEST_DATABASE_URL is not set'
  if (!url.startsWith('postgresql')) return 'TEST_DATABASE_URL is not a postgresql:// URL'
  if (url === process.env.DATABASE_URL) {
    return 'TEST_DATABASE_URL must point at a throwaway database, not the app database'
  }

  return null
}

/** Drop-in replacement for a top-level `describe()` in an integration spec. */
export function describeIntegration(name: string, fn: () => void) {
  const reason = integrationSkipReason()

  if (reason) {
    console.warn(`⚠️  Skipping "${name}": ${reason}`)
    describe.skip(name, fn)
    return
  }

  describe(name, fn)
}
