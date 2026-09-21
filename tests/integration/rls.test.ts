import { describe, it, expect } from 'vitest'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'
import { createDbConnectionConfig } from '~~/server/utils/dbConnection'

const connectionString = process.env.DATABASE_URL

describe.skipIf(!connectionString)('RLS coverage', () => {
  const adapter = new PrismaPg(createDbConnectionConfig(connectionString!))
  const prisma = new PrismaClient({ adapter })

  it('all public tables have RLS enabled', async () => {
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
