import { it, expect } from 'vitest'
import { describeIntegration, testConnectionString } from './_guard'

const connectionString = testConnectionString()

describeIntegration('RLS coverage', () => {
  /**
   * Asserts the `relrowsecurity` flag and nothing else — a green run here is **not** evidence
   * that any query is filtered.
   *
   * There are zero policies on `public` and zero grants to `anon`/`authenticated`/
   * `service_role`, and the application connects as a role with `BYPASSRLS`. So the flag is a
   * default-deny posture for a hypothetical future PostgREST exposure, not a control that does
   * anything today; scoping actually happens in the repository layer and
   * `server/utils/permissions.ts`. Full picture: docs/security.md §10.
   *
   * Testing real enforcement would need a policy *and* a read performed as `anon`, which
   * requires granting `anon` something first. Until then this suite can only detect the flag
   * being turned off, or a new table created without it — which is what happened to
   * `GroupCoOrganizer` once, and why the count below is asserted too.
   */
  it('all public tables have RLS enabled', async () => {
    const { PrismaPg } = await import('@prisma/adapter-pg')
    const { PrismaClient } = await import('@prisma/client')
    const { createDbConnectionConfig } = await import('~~/server/utils/dbConnection')

    const adapter = new PrismaPg(createDbConnectionConfig(connectionString!))
    const prisma = new PrismaClient({ adapter })

    const result = await prisma.$queryRaw<Array<{ relname: string, relrowsecurity: boolean }>>`
      SELECT c.relname, c.relrowsecurity
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE c.relkind = 'r'
        AND n.nspname = 'public'
      ORDER BY c.relname
    `

    const tablesWithoutRls = result.filter(r => !r.relrowsecurity)

    expect(result.length).toBeGreaterThanOrEqual(14)
    expect(tablesWithoutRls).toEqual([])

    await prisma.$disconnect()
  })
})
