import { describe, it, expect, afterAll, beforeAll, vi } from 'vitest'

// groupService opens its own client from DATABASE_URL (server/utils/prisma), so the
// fixtures and the service must target the same database for these assertions to hold.
const connectionString = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL
const hasValidUrl = !!connectionString && connectionString.startsWith('postgresql')

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let db: any
// tests/setup.ts mocks ~~/server/utils/prisma and seeds globalThis.prisma with that mock
// for every file, so the real service has to be imported after both are undone.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let real: { groupService: any, updateGroupSchema: any, prisma: any } | null = null
const cleanup = { userIds: [] as string[], groupIds: [] as string[], organizerIds: [] as string[] }

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

function uniqueSlug(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function uniqueEmail(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}@test.com`
}

async function createOwnerContext() {
  const d = await getDb()
  const user = await d.user.create({ data: { email: uniqueEmail('enddate'), role: 'ORGANIZER' } })
  cleanup.userIds.push(user.id)

  const organizer = await d.organizerProfile.create({
    data: {
      userId: user.id, slug: uniqueSlug('enddate-org'),
      firstName: 'Test', lastName: 'Org', verificationStatus: 'VERIFIED',
    },
  })
  cleanup.organizerIds.push(organizer.id)

  return { userId: user.id, role: 'ORGANIZER', isAdmin: false }
}

async function createGroup(ctx: { userId: string }, endsAt: Date | null) {
  const d = await getDb()
  const organizer = await d.organizerProfile.findFirst({ where: { userId: ctx.userId } })
  const group = await d.group.create({
    data: {
      organizerId: organizer.id, title: 'End date clearing', slug: uniqueSlug('enddate-g'),
      description: 'Temp group for the endDate clearing regression', status: 'DRAFT',
      startsAt: new Date('2026-11-15T17:00:00.000Z'), endsAt,
    },
  })
  cleanup.groupIds.push(group.id)
  return group
}

// Mirrors server/api/groups/[slug].patch.ts: parse first, then hand parsed.data to the service.
async function patch(slug: string, body: Record<string, unknown>, ctx: { userId: string, role: string, isAdmin: boolean }) {
  const { groupService, updateGroupSchema } = real!

  const parsed = updateGroupSchema.safeParse(body)
  if (!parsed.success) {
    return { ok: false as const, issues: parsed.error.issues.map((i: { path: unknown[] }) => i.path.join('.')) }
  }

  await groupService.updateGroup(slug, parsed.data, ctx)
  return { ok: true as const }
}

async function selectEndsAt(groupId: string): Promise<Date | null> {
  const d = await getDb()
  const rows = await d.$queryRaw`SELECT "endsAt" FROM "Group" WHERE id = ${groupId}` as Array<{ endsAt: Date | null }>
  return rows[0]?.endsAt ?? null
}

describe.skipIf(!hasValidUrl)('Group endDate clearing — integration', () => {
  beforeAll(async () => {
    await getDb()

    // Undo tests/setup.ts so the service reaches the real database instead of the mock.
    delete (globalThis as Record<string, unknown>).prisma
    vi.doUnmock('~~/server/utils/prisma')
    vi.resetModules()

    const [serviceModule, validatorModule, prismaModule] = await Promise.all([
      import('~~/server/services/groupService'),
      import('~~/server/validators/group'),
      import('~~/server/utils/prisma'),
    ])
    real = {
      groupService: serviceModule.groupService,
      updateGroupSchema: validatorModule.updateGroupSchema,
      prisma: prismaModule.prisma,
    }
  })

  afterAll(async () => {
    await real?.prisma.$disconnect().catch(() => {})
    if (db) {
      if (cleanup.groupIds.length) {
        await db.group.deleteMany({ where: { id: { in: cleanup.groupIds } } }).catch(() => {})
      }
      if (cleanup.organizerIds.length) {
        await db.organizerProfile.deleteMany({ where: { id: { in: cleanup.organizerIds } } }).catch(() => {})
      }
      if (cleanup.userIds.length) {
        await db.notification.deleteMany({ where: { userId: { in: cleanup.userIds } } }).catch(() => {})
        await db.user.deleteMany({ where: { id: { in: cleanup.userIds } } }).catch(() => {})
      }
      await db.$disconnect()
    }
  })

  it('accepts endDate null through the validator instead of rejecting the patch', async () => {
    const ctx = await createOwnerContext()
    const group = await createGroup(ctx, new Date('2026-11-20T17:00:00.000Z'))

    const result = await patch(group.slug, { endDate: null }, ctx)
    expect(result.issues ?? []).toEqual([])
    expect(result.ok).toBe(true)
  })

  it('stores endsAt when the patch carries an ISO endDate', async () => {
    const ctx = await createOwnerContext()
    const group = await createGroup(ctx, null)

    await patch(group.slug, { endDate: '2026-11-20T17:00:00.000Z' }, ctx)

    expect(await selectEndsAt(group.id)).toEqual(new Date('2026-11-20T17:00:00.000Z'))
  })

  it('clears a stored endsAt back to NULL when the patch sends endDate null', async () => {
    const ctx = await createOwnerContext()
    const group = await createGroup(ctx, new Date('2026-11-20T17:00:00.000Z'))
    expect(await selectEndsAt(group.id)).not.toBeNull()

    await patch(group.slug, { endDate: null }, ctx)

    const endsAt = await selectEndsAt(group.id)
    console.warn(`SELECT "endsAt" FROM "Group" WHERE id = '${group.id}' ->`, endsAt)
    expect(endsAt).toBeNull()
  })

  it('leaves a stored endsAt untouched when endDate is absent from the patch', async () => {
    const ctx = await createOwnerContext()
    const stored = new Date('2026-11-20T17:00:00.000Z')
    const group = await createGroup(ctx, stored)

    await patch(group.slug, { title: 'Title only' }, ctx)

    expect(await selectEndsAt(group.id)).toEqual(stored)
  })

  it('keeps NULL endsAt for a group created without an end date', async () => {
    const ctx = await createOwnerContext()
    const group = await createGroup(ctx, null)

    expect(await selectEndsAt(group.id)).toBeNull()
  })
})
