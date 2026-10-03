import { it, expect } from 'vitest'
import { describeIntegration, testConnectionString } from './_guard'

const connectionString = testConnectionString()

describeIntegration('RLS coverage', () => {
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
