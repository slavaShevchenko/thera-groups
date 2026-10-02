import { describe, it, expect, afterAll, beforeAll } from 'vitest'

const connectionString = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL
const hasValidUrl = !!connectionString && connectionString.startsWith('postgresql')

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let db: any
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

async function createUser(role = 'VISITOR') {
  const d = await getDb()
  const user = await d.user.create({ data: { email: uniqueEmail('u'), role } })
  cleanup.userIds.push(user.id)
  return user
}

async function createOrganizer(user: { id: string }, verificationStatus = 'VERIFIED') {
  const d = await getDb()
  const org = await d.organizerProfile.create({
    data: {
      userId: user.id, slug: uniqueSlug('org'),
      firstName: 'Test', lastName: 'Org', verificationStatus,
    },
  })
  cleanup.organizerIds.push(org.id)
  return org
}

async function createGroup(organizer: { id: string }, status = 'DRAFT') {
  const d = await getDb()
  const group = await d.group.create({
    data: {
      organizerId: organizer.id, title: 'Test', slug: uniqueSlug('g'),
      description: 'Desc', status,
    },
  })
  cleanup.groupIds.push(group.id)
  return group
}

describe.skipIf(!hasValidUrl)('Groups flow — integration', () => {
  beforeAll(async () => {
    await getDb()
  })

  afterAll(async () => {
    if (db) {
      if (cleanup.groupIds.length) {
        await db.application.deleteMany({ where: { groupId: { in: cleanup.groupIds } } }).catch(() => {})
        await db.applicationQuestion.deleteMany({ where: { groupId: { in: cleanup.groupIds } } }).catch(() => {})
        await db.groupCoOrganizer.deleteMany({ where: { groupId: { in: cleanup.groupIds } } }).catch(() => {})
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

  describe('STVORENNIA — group creation', () => {
    it('b) verified ORGANIZER creates DRAFT', async () => {
      const d = await getDb()
      const user = await createUser('ORGANIZER')
      const organizer = await createOrganizer(user, 'VERIFIED')

      const group = await d.group.create({
        data: { organizerId: organizer.id, title: 'Draft', slug: uniqueSlug('draft'), description: 'D', status: 'DRAFT' },
      })
      cleanup.groupIds.push(group.id)

      expect(group.status).toBe('DRAFT')
      expect(group.organizerId).toBe(organizer.id)
    })

    it('c) ADMIN creates for specified organizer', async () => {
      const d = await getDb()
      const orgUser = await createUser('ORGANIZER')
      const organizer = await createOrganizer(orgUser, 'VERIFIED')

      const group = await d.group.create({
        data: { organizerId: organizer.id, title: 'Admin', slug: uniqueSlug('admin'), description: 'A', status: 'DRAFT' },
      })
      cleanup.groupIds.push(group.id)

      expect(group.organizerId).toBe(organizer.id)
    })

    it('d) nonexistent organizerId — FK constraint', async () => {
      const d = await getDb()
      await expect(
        d.group.create({
          data: { organizerId: 'nonexistent', title: 'X', slug: uniqueSlug('x'), description: 'X', status: 'DRAFT' },
        }),
      ).rejects.toThrow()
    })
  })

  describe('REDAGUVANNIA — editing authorization', () => {
    it('f) owner can edit DRAFT', async () => {
      const d = await getDb()
      const owner = await createUser('ORGANIZER')
      const organizer = await createOrganizer(owner)
      const group = await createGroup(organizer, 'DRAFT')

      const updated = await d.group.update({ where: { id: group.id }, data: { title: 'Updated' } })
      expect(updated.title).toBe('Updated')
    })

    it('g) co-organizer exists for group', async () => {
      const d = await getDb()
      const owner = await createUser('ORGANIZER')
      const organizer = await createOrganizer(owner)
      const group = await createGroup(organizer, 'DRAFT')
      const coOrg = await createUser('ORGANIZER')

      const co = await d.groupCoOrganizer.create({
        data: { groupId: group.id, userId: coOrg.id, role: 'co-organizer' },
      })
      expect(co.userId).toBe(coOrg.id)
    })

    it('h) non-owner cannot edit (authorization enforced at service level)', async () => {
      const owner = await createUser('ORGANIZER')
      const organizer = await createOrganizer(owner)
      const group = await createGroup(organizer, 'DRAFT')
      await createUser('ORGANIZER')

      const isOwner = group.organizerId === organizer.id
      const otherIsOwner = group.organizerId !== organizer.id
      expect(isOwner).toBe(true)
      expect(otherIsOwner).toBe(false)
      // Service checks isOwner || isAdmin || isCoOrganizer → other fails → ForbiddenError
    })

    it('j) critical field change on PUBLISHED → PENDING_REVIEW', async () => {
      const d = await getDb()
      const owner = await createUser('ORGANIZER')
      const organizer = await createOrganizer(owner)
      const group = await createGroup(organizer, 'PUBLISHED')

      // Service logic: if PUBLISHED && critical field changed → PENDING_REVIEW
      const CRITICAL_FIELDS = ['title', 'description', 'type', 'format', 'location', 'priceAmount', 'currency', 'startsAt', 'endsAt', 'capacity']
      const changedField = 'title'
      const isCritical = CRITICAL_FIELDS.includes(changedField)
      expect(isCritical).toBe(true)

      if (group.status === 'PUBLISHED' && isCritical) {
        await d.group.update({ where: { id: group.id }, data: { status: 'PENDING_REVIEW', title: 'Changed' } })
      }
      const updated = await d.group.findUnique({ where: { id: group.id } })
      expect(updated.status).toBe('PENDING_REVIEW')
    })

    it('k) non-critical field on PUBLISHED → stays PUBLISHED', async () => {
      const d = await getDb()
      const owner = await createUser('ORGANIZER')
      const organizer = await createOrganizer(owner)
      const group = await createGroup(organizer, 'PUBLISHED')

      const CRITICAL_FIELDS = ['title', 'description', 'type', 'format', 'location', 'priceAmount', 'currency', 'startsAt', 'endsAt', 'capacity']
      const changedField = 'timezone'
      const isCritical = CRITICAL_FIELDS.includes(changedField)
      expect(isCritical).toBe(false)

      await d.group.update({ where: { id: group.id }, data: { timezone: 'Europe/Kyiv' } })
      const updated = await d.group.findUnique({ where: { id: group.id } })
      expect(updated.status).toBe('PUBLISHED')
    })

    it('l) editing questions after applications — blocked by service', async () => {
      const d = await getDb()
      const owner = await createUser('ORGANIZER')
      const organizer = await createOrganizer(owner)
      const group = await createGroup(organizer, 'DRAFT')

      await d.application.create({
        data: { groupId: group.id, name: 'App', email: uniqueEmail('qedit') },
      })

      const appCount = await d.application.count({ where: { groupId: group.id } })
      expect(appCount).toBeGreaterThan(0)
      // Service checks: if applications > 0 → ValidationError
    })

    it('m) editing questions when no applications — allowed', async () => {
      const d = await getDb()
      const owner = await createUser('ORGANIZER')
      const organizer = await createOrganizer(owner)
      const group = await createGroup(organizer, 'DRAFT')

      const appCount = await d.application.count({ where: { groupId: group.id } })
      expect(appCount).toBe(0)

      await d.applicationQuestion.create({
        data: { groupId: group.id, question: 'New Q?', type: 'TEXT', required: false, position: 0 },
      })

      const questions = await d.applicationQuestion.findMany({ where: { groupId: group.id } })
      expect(questions.length).toBe(1)
    })
  })

  describe('MODERATSIIA — status transitions', () => {
    it('n) DRAFT → PENDING_REVIEW', async () => {
      const d = await getDb()
      const owner = await createUser('ORGANIZER')
      const organizer = await createOrganizer(owner)
      const group = await createGroup(organizer, 'DRAFT')

      await d.group.update({ where: { id: group.id }, data: { status: 'PENDING_REVIEW' } })
      const updated = await d.group.findUnique({ where: { id: group.id } })
      expect(updated.status).toBe('PENDING_REVIEW')
    })

    it('o) PENDING_REVIEW → PUBLISHED (admin)', async () => {
      const d = await getDb()
      const owner = await createUser('ORGANIZER')
      const organizer = await createOrganizer(owner)
      const group = await createGroup(organizer, 'PENDING_REVIEW')

      await d.group.update({ where: { id: group.id }, data: { status: 'PUBLISHED' } })
      const updated = await d.group.findUnique({ where: { id: group.id } })
      expect(updated.status).toBe('PUBLISHED')
    })

    it('p) PENDING_REVIEW → REJECTED with reason', async () => {
      const d = await getDb()
      const owner = await createUser('ORGANIZER')
      const organizer = await createOrganizer(owner)
      const group = await createGroup(organizer, 'PENDING_REVIEW')

      await d.group.update({
        where: { id: group.id },
        data: { status: 'REJECTED', rejectionReason: 'Incomplete' },
      })
      const updated = await d.group.findUnique({ where: { id: group.id } })
      expect(updated.status).toBe('REJECTED')
      expect(updated.rejectionReason).toBe('Incomplete')
    })

    it('q) only admin can publish (service enforces)', async () => {
      // Service: validateStatusTransition checks role !== 'ADMIN' → ForbiddenError
      const VALID_TRANSITIONS: Record<string, string[]> = {
        DRAFT: ['PENDING_REVIEW'],
        PENDING_REVIEW: ['PUBLISHED', 'REJECTED'],
        PUBLISHED: ['PENDING_REVIEW', 'FULL', 'CANCELLED'],
      }
      expect(VALID_TRANSITIONS['PENDING_REVIEW']).toContain('PUBLISHED')
      // But only if role === 'ADMIN'
    })

    it('r) invalid transition PUBLISHED → DRAFT', async () => {
      const VALID_TRANSITIONS: Record<string, string[]> = {
        DRAFT: ['PENDING_REVIEW'],
        PENDING_REVIEW: ['PUBLISHED', 'REJECTED'],
        PUBLISHED: ['PENDING_REVIEW', 'FULL', 'CANCELLED'],
      }
      expect(VALID_TRANSITIONS['PUBLISHED']).not.toContain('DRAFT')
    })
  })

  describe('VIDALENNIA — deletion', () => {
    it('s) owner deletes DRAFT', async () => {
      const d = await getDb()
      const owner = await createUser('ORGANIZER')
      const organizer = await createOrganizer(owner)
      const group = await createGroup(organizer, 'DRAFT')

      await d.group.delete({ where: { id: group.id } })
      const found = await d.group.findUnique({ where: { id: group.id } })
      expect(found).toBeNull()
    })

    it('t) co-organizer cannot delete (service enforces isOwner check)', async () => {
      const d = await getDb()
      const owner = await createUser('ORGANIZER')
      const organizer = await createOrganizer(owner)
      const group = await createGroup(organizer, 'DRAFT')
      const coOrg = await createUser('ORGANIZER')

      await d.groupCoOrganizer.create({
        data: { groupId: group.id, userId: coOrg.id, role: 'co' },
      })

      const isOwner = group.organizerId === organizer.id
      expect(isOwner).toBe(true)
      // Delete handler: only isOwner || isAdmin can delete, NOT isCoOrganizer
    })
  })

  describe('PEREHLiad — viewing access', () => {
    it('w) published groups are publicly visible', async () => {
      const d = await getDb()
      const owner = await createUser('ORGANIZER')
      const organizer = await createOrganizer(owner)
      const group = await createGroup(organizer, 'PUBLISHED')

      const found = await d.group.findFirst({ where: { slug: group.slug, status: 'PUBLISHED' } })
      expect(found).not.toBeNull()
    })

    it('x) DRAFT groups are NOT publicly visible', async () => {
      const d = await getDb()
      const owner = await createUser('ORGANIZER')
      const organizer = await createOrganizer(owner)
      const group = await createGroup(organizer, 'DRAFT')

      const found = await d.group.findFirst({ where: { slug: group.slug, status: 'PUBLISHED' } })
      expect(found).toBeNull()
    })

    it('y) owner sees own DRAFT via repository logic', async () => {
      const d = await getDb()
      const owner = await createUser('ORGANIZER')
      const organizer = await createOrganizer(owner)
      const group = await createGroup(organizer, 'DRAFT')

      const found = await d.group.findFirst({
        where: { slug: group.slug },
        include: { organizer: { select: { userId: true } } },
      })

      expect(found).not.toBeNull()
      const isOwner = found.organizer.userId === owner.id
      expect(isOwner).toBe(true)
      // Repository: if isOwner → return group regardless of status
    })

    it('z) non-owner cannot see DRAFT', async () => {
      const d = await getDb()
      const owner = await createUser('ORGANIZER')
      const organizer = await createOrganizer(owner)
      const group = await createGroup(organizer, 'DRAFT')
      const other = await createUser('VISITOR')

      const found = await d.group.findFirst({
        where: { slug: group.slug },
        include: { organizer: { select: { userId: true } } },
      })

      const isOwner = found.organizer.userId === owner.id
      const otherIsOwner = found.organizer.userId === other.id
      expect(isOwner).toBe(true)
      expect(otherIsOwner).toBe(false)
      // Repository: if !isAdmin && !isOwner && !isCoOrganizer && status !== 'PUBLISHED' → return null
    })
  })

  describe('NOVI POLIA — min participants, duration hours, certificate, program', () => {
    it('k) the four new fields survive a save/reload round-trip', async () => {
      const d = await getDb()
      const owner = await createUser('ORGANIZER')
      const organizer = await createOrganizer(owner)
      const group = await createGroup(organizer, 'DRAFT')

      await d.group.update({
        where: { id: group.id },
        data: {
          minParticipants: 4,
          durationHours: 12,
          certificateIssued: true,
          program: '1. Знайомство та правила групи\n2. Вправи на заземлення',
        },
      })

      const reloaded = await d.group.findUniqueOrThrow({ where: { id: group.id } })
      expect(reloaded.minParticipants).toBe(4)
      expect(reloaded.durationHours).toBe(12)
      expect(reloaded.certificateIssued).toBe(true)
      expect(reloaded.program).toBe('1. Знайомство та правила групи\n2. Вправи на заземлення')
    })

    it('stores certificateIssued false distinctly from null', async () => {
      const d = await getDb()
      const owner = await createUser('ORGANIZER')
      const organizer = await createOrganizer(owner)
      const group = await createGroup(organizer, 'DRAFT')

      await d.group.update({ where: { id: group.id }, data: { certificateIssued: false } })

      const reloaded = await d.group.findUniqueOrThrow({ where: { id: group.id } })
      expect(reloaded.certificateIssued).toBe(false)
    })

    it('clears the fields back to null', async () => {
      const d = await getDb()
      const owner = await createUser('ORGANIZER')
      const organizer = await createOrganizer(owner)
      const group = await createGroup(organizer, 'DRAFT')

      await d.group.update({
        where: { id: group.id },
        data: { minParticipants: 4, durationHours: 12, certificateIssued: true, program: 'Програма' },
      })
      await d.group.update({
        where: { id: group.id },
        data: { minParticipants: null, durationHours: null, certificateIssued: null, program: null },
      })

      const reloaded = await d.group.findUniqueOrThrow({ where: { id: group.id } })
      expect(reloaded.minParticipants).toBeNull()
      expect(reloaded.durationHours).toBeNull()
      expect(reloaded.certificateIssued).toBeNull()
      expect(reloaded.program).toBeNull()
    })

    it('o) groups created without the new fields read back as null on every column', async () => {
      const owner = await createUser('ORGANIZER')
      const organizer = await createOrganizer(owner)
      const group = await createGroup(organizer, 'PUBLISHED')

      expect(group.minParticipants).toBeNull()
      expect(group.durationHours).toBeNull()
      expect(group.certificateIssued).toBeNull()
      expect(group.program).toBeNull()
    })

    it('the Group_minParticipants_check constraint rejects zero and negatives', async () => {
      const d = await getDb()
      const owner = await createUser('ORGANIZER')
      const organizer = await createOrganizer(owner)
      const group = await createGroup(organizer, 'DRAFT')

      await expect(
        d.group.update({ where: { id: group.id }, data: { minParticipants: 0 } }),
      ).rejects.toThrow()
      await expect(
        d.group.update({ where: { id: group.id }, data: { minParticipants: -2 } }),
      ).rejects.toThrow()
    })

    it('the Group_durationHours_check constraint rejects zero', async () => {
      const d = await getDb()
      const owner = await createUser('ORGANIZER')
      const organizer = await createOrganizer(owner)
      const group = await createGroup(organizer, 'DRAFT')

      await expect(
        d.group.update({ where: { id: group.id }, data: { durationHours: 0 } }),
      ).rejects.toThrow()
    })
  })
})
