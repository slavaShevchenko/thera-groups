import { it, expect, beforeAll, afterAll, vi } from 'vitest'
import { describeIntegration, testConnectionString } from './_guard'

const connectionString = testConnectionString()

const { adminEmail, adminPassword } = vi.hoisted(() => ({
  adminEmail: `bootstrap-it-${Date.now()}@test.local`,
  adminPassword: 'never-used-against-a-provider',
}))

// The Supabase half is faked: this suite is about what lands in the database, and a real
// `createUser` would leave an auth account nobody can sign into.
vi.mock('~~/server/utils/supabase', () => ({
  createAdminClient: () => ({
    auth: {
      admin: {
        createUser: async () => ({ data: { user: { id: 'auth-bootstrap-it', email: adminEmail } }, error: null }),
        deleteUser: async () => ({ data: null, error: null }),
      },
    },
  }),
  findAuthUsersByEmail: async () => [],
}))

// useServerConfig() reads the Nitro runtime config, which does not exist outside a server.
vi.mock('~~/server/utils/config', () => ({
  useServerConfig: () => ({ adminEmail, adminPassword }),
}))

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let db: any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let bootstrapPrisma: any
let bootstrapFirstAdmin: () => Promise<string>
let originalDatabaseUrl: string | undefined

// Admins that were already in the database. The creation path is only exercised when there
// are none, because emptying a shared database of its admins is not this suite's call.
let adminsBefore = 0
let createdAdminId: string | null = null

async function getDb() {
  if (!db) {
    const { PrismaPg } = await import('@prisma/adapter-pg')
    const { PrismaClient } = await import('@prisma/client')
    const { createDbConnectionConfig } = await import('~~/server/utils/dbConnection')
    const adapter = new PrismaPg(createDbConnectionConfig(connectionString!))
    db = new PrismaClient({ adapter })
  }
  return db
}

async function countAdmins(): Promise<number> {
  const d = await getDb()
  return d.user.count({ where: { role: 'ADMIN' } })
}

describeIntegration('First-admin bootstrap — integration', () => {
  beforeAll(async () => {
    await getDb()

    adminsBefore = await countAdmins()

    originalDatabaseUrl = process.env.DATABASE_URL
    process.env.DATABASE_URL = connectionString!

    // Undo tests/setup.ts so the bootstrap reaches the real database.
    delete (globalThis as Record<string, unknown>).prisma
    vi.doUnmock('~~/server/utils/prisma')
    vi.resetModules()

    const [bootstrapModule, prismaModule] = await Promise.all([
      import('~~/server/utils/bootstrap'),
      import('~~/server/utils/prisma'),
    ])

    bootstrapFirstAdmin = bootstrapModule.bootstrapFirstAdmin
    bootstrapPrisma = prismaModule.prisma
  })

  afterAll(async () => {
    if (createdAdminId && bootstrapPrisma) {
      await bootstrapPrisma.user.delete({ where: { id: createdAdminId } }).catch(() => {})
    }

    if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL
    else process.env.DATABASE_URL = originalDatabaseUrl

    await bootstrapPrisma?.$disconnect().catch(() => {})
    await db?.$disconnect().catch(() => {})
  })

  it('leaves a database that already has an admin untouched', async (t) => {
    if (adminsBefore === 0) return t.skip()

    const before = await countAdmins()

    await expect(bootstrapFirstAdmin()).resolves.toBe('already-present')

    expect(await countAdmins()).toBe(before)
    expect(await db.user.findUnique({ where: { email: adminEmail } })).toBeNull()
  })

  it('creates exactly one ADMIN on a database that has none', async (t) => {
    // Cold start is the only state this is observable in, and a suite that ran earlier may
    // have left an admin behind. Skipping says so instead of passing without asserting.
    if (adminsBefore > 0) return t.skip()

    await expect(bootstrapFirstAdmin()).resolves.toBe('created')

    const created = await db.user.findUnique({ where: { email: adminEmail } })
    expect(created).toMatchObject({ role: 'ADMIN', isActive: true })
    expect(created.authId).toBe('auth-bootstrap-it')
    createdAdminId = created.id

    expect(await countAdmins()).toBe(1)
  })

  it('is a noop on every call after the first', async (t) => {
    if (adminsBefore > 0) return t.skip()

    const before = await countAdmins()

    await expect(bootstrapFirstAdmin()).resolves.toBe('already-present')
    await expect(bootstrapFirstAdmin()).resolves.toBe('already-present')

    expect(await countAdmins()).toBe(before)
    expect(await db.user.findMany({ where: { email: adminEmail } })).toHaveLength(1)
  })
})
