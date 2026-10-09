import { it, expect, afterAll, beforeAll, vi } from 'vitest'
import { describeIntegration, testConnectionString } from './_guard'

const connectionString = testConnectionString()

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let db: any
// server/utils/prisma.ts reads DATABASE_URL at import time; see beforeAll.
let originalDatabaseUrl: string | undefined

// tests/setup.ts mocks ~~/server/utils/prisma for every file, so the real repositories have
// to be imported after that mock is undone — otherwise the `select` under test never runs.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let real: { organizerRepository: any, groupRepository: any, mapGroupCard: any } | null = null

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

/**
 * An organizer the public must not learn anything about beyond the card.
 *
 * REJECTED with a reason, and holding a group in every status that carries one: this is
 * the fixture that makes a leak visible. A VERIFIED profile with a single PUBLISHED group
 * would pass every assertion below even if the read selected `*`.
 */
async function createLeakyOrganizer() {
  const d = await getDb()

  const user = await d.user.create({
    data: { email: uniqueEmail('public-reads'), role: 'ORGANIZER' },
  })
  cleanup.userIds.push(user.id)

  const organizer = await d.organizerProfile.create({
    data: {
      userId: user.id,
      slug: uniqueSlug('public-reads-org'),
      firstName: 'Таємний',
      lastName: 'Організатор',
      verificationStatus: 'REJECTED',
      rejectionReason: 'Не підтверджено освіту — внутрішня примка модератора',
      website: 'https://internal.example.com',
    },
  })
  cleanup.organizerIds.push(organizer.id)

  const groups = await Promise.all(
    ['DRAFT', 'REJECTED', 'PUBLISHED'].map(status => d.group.create({
      data: {
        organizerId: organizer.id,
        title: `Група ${status}`,
        slug: uniqueSlug(`public-reads-${status.toLowerCase()}`),
        description: `Опис для ${status}`,
        program: `Програма для ${status}`,
        status,
        timezone: 'Europe/Kyiv',
        rejectionReason: status === 'REJECTED' ? 'Причина відмови модератора' : null,
        startsAt: new Date('2030-01-10T17:00:00.000Z'),
        endsAt: new Date('2030-02-10T17:00:00.000Z'),
      },
    })),
  )
  for (const group of groups) cleanup.groupIds.push(group.id)

  return { user, organizer, groups }
}

describeIntegration('Public reads — integration', () => {
  beforeAll(async () => {
    await getDb()

    originalDatabaseUrl = process.env.DATABASE_URL
    process.env.DATABASE_URL = connectionString!

    delete (globalThis as Record<string, unknown>).prisma
    vi.doUnmock('~~/server/utils/prisma')
    vi.resetModules()

    const [organizerModule, groupModule, responseModule] = await Promise.all([
      import('~~/server/repositories/organizerRepository'),
      import('~~/server/repositories/groupRepository'),
      import('~~/server/utils/groupResponse'),
    ])
    real = {
      organizerRepository: organizerModule.organizerRepository,
      groupRepository: groupModule.groupRepository,
      mapGroupCard: responseModule.mapGroupCard,
    }
  })

  afterAll(async () => {
    if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL
    else process.env.DATABASE_URL = originalDatabaseUrl

    if (db) {
      if (cleanup.groupIds.length) {
        await db.group.deleteMany({ where: { id: { in: cleanup.groupIds } } }).catch(() => { })
      }
      if (cleanup.organizerIds.length) {
        await db.organizerProfile.deleteMany({ where: { id: { in: cleanup.organizerIds } } }).catch(() => { })
      }
      if (cleanup.userIds.length) {
        await db.user.deleteMany({ where: { id: { in: cleanup.userIds } } }).catch(() => { })
      }
      await db.$disconnect()
    }
  })

  describe('the public organizer profile read', () => {
    it('selects no column an anonymous visitor has no use for', async () => {
      const { organizer, groups } = await createLeakyOrganizer()

      const profile = await real!.organizerRepository.findBySlugWithGroups(organizer.slug)

      expect(profile).not.toBeNull()
      // `userId` is the value every ownership check on the server trusts; the profile cuid
      // is the value an attacker would need to guess admin routes against.
      expect(profile).not.toHaveProperty('id')
      expect(profile).not.toHaveProperty('userId')
      expect(profile).not.toHaveProperty('rejectionReason')
      expect(profile).not.toHaveProperty('website')
      expect(profile).not.toHaveProperty('createdAt')
      expect(profile).not.toHaveProperty('updatedAt')
      expect(profile).not.toHaveProperty('user')
      // What the page renders is still there.
      expect(profile).toMatchObject({
        slug: organizer.slug,
        firstName: 'Таємний',
        verificationStatus: 'REJECTED',
      })

      const published = groups.find((g: { status: string }) => g.status === 'PUBLISHED')
      expect(profile.groups.map((g: { slug: string }) => g.slug)).toEqual([published.slug])
    })

    it('ships none of a group\'s private columns on the profile page', async () => {
      const { organizer } = await createLeakyOrganizer()

      const profile = await real!.organizerRepository.findBySlugWithGroups(organizer.slug)
      const group = profile.groups[0]

      expect(group).not.toHaveProperty('id')
      expect(group).not.toHaveProperty('organizerId')
      expect(group).not.toHaveProperty('timezone')
      expect(group).not.toHaveProperty('description')
      expect(group).not.toHaveProperty('program')
      expect(group).not.toHaveProperty('rejectionReason')
      expect(group).not.toHaveProperty('questions')
      expect(group.slug).toBeTruthy()
    })

    it('serializes to a body with no userId, organizerId or rejectionReason anywhere', async () => {
      const { organizer } = await createLeakyOrganizer()

      const profile = await real!.organizerRepository.findBySlugWithGroups(organizer.slug)
      const body = JSON.stringify({ ...profile, groups: profile.groups.map(real!.mapGroupCard) })

      expect(body).not.toContain('userId')
      expect(body).not.toContain('organizerId')
      expect(body).not.toContain('rejectionReason')
      expect(body).not.toContain('timezone')
      expect(body).not.toContain(organizer.id)
      // The moderation note is the payload a leak would actually expose.
      expect(body).not.toContain('внутрішня примка модератора')
      expect(body).not.toContain('Причина відмови модератора')
    })

    it('lists no group that is not publicly visible', async () => {
      const { organizer, groups } = await createLeakyOrganizer()
      const d = await getDb()

      // FULL and COMPLETED stay listed — they are public statuses — but a draft and a
      // rejected group are published nowhere and must not appear on the profile.
      const published = groups.find((g: { status: string }) => g.status === 'PUBLISHED')
      await d.group.update({ where: { id: published.id }, data: { status: 'FULL' } })
      const completed = await d.group.create({
        data: {
          organizerId: organizer.id,
          title: 'Завершена',
          slug: uniqueSlug('public-reads-completed'),
          description: 'Опис',
          status: 'COMPLETED',
          startsAt: new Date('2030-01-10T17:00:00.000Z'),
        },
      })
      cleanup.groupIds.push(completed.id)

      const profile = await real!.organizerRepository.findBySlugWithGroups(organizer.slug)
      const slugs = profile.groups.map((g: { slug: string }) => g.slug)

      expect(slugs).toContain(published.slug)
      expect(slugs).toContain(completed.slug)
      expect(slugs).toHaveLength(2)
    })
  })

  describe('the public group read', () => {
    it('returns nothing at all for a draft, with or without a viewer', async () => {
      const { groups } = await createLeakyOrganizer()
      const draft = groups.find((g: { status: string }) => g.status === 'DRAFT')

      expect(await real!.groupRepository.findBySlug(draft.slug)).toBeNull()
      // A visitor session is still not a privileged one: no viewer context, no group.
      expect(await real!.groupRepository.findBySlug(draft.slug, {})).toBeNull()
    })

    it('returns the published group to an anonymous viewer', async () => {
      const { groups } = await createLeakyOrganizer()
      const published = groups.find((g: { status: string }) => g.status === 'PUBLISHED')

      const group = await real!.groupRepository.findBySlug(published.slug)

      expect(group).not.toBeNull()
      expect(group!.slug).toBe(published.slug)
    })
  })
})
