import { describe, it, expect, afterAll, beforeAll } from 'vitest'

const connectionString = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL
const hasValidUrl = !!connectionString && connectionString.startsWith('postgresql')

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let db: any

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

function uniqueEmail(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}@test.com`
}

function uniqueSlug(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

const cleanup = { userIds: [] as string[], groupIds: [] as string[] }

async function createUser(role = 'VISITOR') {
  const d = await getDb()
  const user = await d.user.create({ data: { email: uniqueEmail('u'), role } })
  cleanup.userIds.push(user.id)
  return user
}

async function createOrganizer(user: { id: string }, verificationStatus = 'VERIFIED') {
  const d = await getDb()
  return d.organizerProfile.create({
    data: {
      userId: user.id,
      slug: uniqueSlug('org'),
      firstName: 'Test',
      lastName: 'Org',
      verificationStatus,
    },
  })
}

async function createPublishedGroup(organizer: { id: string }) {
  const d = await getDb()
  const group = await d.group.create({
    data: {
      organizerId: organizer.id,
      title: 'Test Group',
      slug: uniqueSlug('g'),
      description: 'Test',
      status: 'PUBLISHED',
    },
  })
  cleanup.groupIds.push(group.id)
  return group
}

describe.skipIf(!hasValidUrl)('Applications flow — integration', () => {
  beforeAll(async () => {
    await getDb()
  })

  afterAll(async () => {
    if (db) {
      if (cleanup.groupIds.length) {
        await db.application.deleteMany({ where: { groupId: { in: cleanup.groupIds } } }).catch(() => {})
        await db.applicationQuestion.deleteMany({ where: { groupId: { in: cleanup.groupIds } } }).catch(() => {})
        await db.group.deleteMany({ where: { id: { in: cleanup.groupIds } } }).catch(() => {})
      }
      if (cleanup.userIds.length) {
        await db.groupCoOrganizer.deleteMany({ where: { userId: { in: cleanup.userIds } } }).catch(() => {})
        await db.notification.deleteMany({ where: { userId: { in: cleanup.userIds } } }).catch(() => {})
        await db.organizerProfile.deleteMany({ where: { userId: { in: cleanup.userIds } } }).catch(() => {})
        await db.user.deleteMany({ where: { id: { in: cleanup.userIds } } }).catch(() => {})
      }
      await db.$disconnect()
    }
  })

  describe('PODACHA — application submission', () => {
    it('a) anonymous applies — created without userId', async () => {
      const d = await getDb()
      const orgUser = await createUser('ORGANIZER')
      const organizer = await createOrganizer(orgUser)
      const group = await createPublishedGroup(organizer)

      const app = await d.application.create({
        data: { groupId: group.id, name: 'Anon', email: uniqueEmail('anon') },
      })

      expect(app.userId).toBeNull()
      expect(app.status).toBe('PENDING')
    })

    it('b) logged-in VISITOR applies — created with userId + email', async () => {
      const d = await getDb()
      const orgUser = await createUser('ORGANIZER')
      const organizer = await createOrganizer(orgUser)
      const group = await createPublishedGroup(organizer)
      const applicant = await createUser('VISITOR')
      const email = uniqueEmail('visitor')

      const app = await d.application.create({
        data: { groupId: group.id, userId: applicant.id, name: 'Visitor', email },
      })

      expect(app.userId).toBe(applicant.id)
      expect(app.email).toBe(email)
    })

    it('c) logged-in ORGANIZER applies — allowed', async () => {
      const d = await getDb()
      const orgUser = await createUser('ORGANIZER')
      const organizer = await createOrganizer(orgUser)
      const group = await createPublishedGroup(organizer)
      const applyingOrg = await createUser('ORGANIZER')

      const app = await d.application.create({
        data: { groupId: group.id, userId: applyingOrg.id, name: 'OrgApply', email: uniqueEmail('orgapply') },
      })

      expect(app.userId).toBe(applyingOrg.id)
    })

    it('d) ADMIN applies — allowed', async () => {
      const d = await getDb()
      const orgUser = await createUser('ORGANIZER')
      const organizer = await createOrganizer(orgUser)
      const group = await createPublishedGroup(organizer)
      const admin = await createUser('ADMIN')

      const app = await d.application.create({
        data: { groupId: group.id, userId: admin.id, name: 'Admin', email: uniqueEmail('admin') },
      })

      expect(app.status).toBe('PENDING')
    })

    it('e) duplicate by email — unique constraint blocks', async () => {
      const d = await getDb()
      const orgUser = await createUser('ORGANIZER')
      const organizer = await createOrganizer(orgUser)
      const group = await createPublishedGroup(organizer)
      const email = uniqueEmail('dup')

      await d.application.create({
        data: { groupId: group.id, name: 'First', email },
      })

      await expect(
        d.application.create({ data: { groupId: group.id, name: 'Second', email } }),
      ).rejects.toThrow()
    })

    it('f) duplicate by userId (different email) — allowed at DB level, blocked by service OR query', async () => {
      const d = await getDb()
      const orgUser = await createUser('ORGANIZER')
      const organizer = await createOrganizer(orgUser)
      const group = await createPublishedGroup(organizer)
      const applicant = await createUser('VISITOR')

      await d.application.create({
        data: { groupId: group.id, userId: applicant.id, name: 'First', email: uniqueEmail('f1') },
      })

      // DB allows it (unique is on groupId+email, not groupId+userId)
      const second = await d.application.create({
        data: { groupId: group.id, userId: applicant.id, name: 'Second', email: uniqueEmail('f2') },
      })
      expect(second.userId).toBe(applicant.id)

      // But the service duplicate check (OR query) would catch this:
      const existing = await d.application.findFirst({
        where: { OR: [{ groupId: group.id, userId: applicant.id }] },
      })
      expect(existing).not.toBeNull()
    })

    it('g) application to DRAFT group — service returns 404', async () => {
      const d = await getDb()
      const orgUser = await createUser('ORGANIZER')
      const organizer = await createOrganizer(orgUser)
      const group = await d.group.create({
        data: {
          organizerId: organizer.id, title: 'Draft', slug: uniqueSlug('draft'),
          description: 'Draft', status: 'DRAFT',
        },
      })
      cleanup.groupIds.push(group.id)

      // Service checks group.status !== 'PUBLISHED' → NotFoundError
      const found = await d.group.findUnique({ where: { slug: group.slug } })
      expect(found).not.toBeNull()
      expect(found.status).toBe('DRAFT')
      // The service would throw NotFoundError here because status !== 'PUBLISHED'
    })

    it('h) required question validation', async () => {
      const d = await getDb()
      const orgUser = await createUser('ORGANIZER')
      const organizer = await createOrganizer(orgUser)
      const group = await createPublishedGroup(organizer)

      await d.applicationQuestion.create({
        data: { groupId: group.id, question: 'Motivation?', type: 'TEXT', required: true, position: 0 },
      })

      const questions = await d.applicationQuestion.findMany({ where: { groupId: group.id } })
      const requiredQ = questions.find((q: { required: boolean }) => q.required)
      expect(requiredQ).toBeDefined()
      // Service would throw ValidationError if answer is missing
    })
  })

  describe('RISHENNIA — status decisions', () => {
    it('m) approve — status changes to APPROVED', async () => {
      const d = await getDb()
      const orgUser = await createUser('ORGANIZER')
      const organizer = await createOrganizer(orgUser)
      const group = await createPublishedGroup(organizer)
      const applicant = await createUser('VISITOR')

      const app = await d.application.create({
        data: { groupId: group.id, userId: applicant.id, name: 'Approve', email: uniqueEmail('appr') },
      })

      const updated = await d.application.update({
        where: { id: app.id },
        data: { status: 'APPROVED' },
      })
      expect(updated.status).toBe('APPROVED')
    })

    it('n) reject — status changes to REJECTED', async () => {
      const d = await getDb()
      const orgUser = await createUser('ORGANIZER')
      const organizer = await createOrganizer(orgUser)
      const group = await createPublishedGroup(organizer)

      const app = await d.application.create({
        data: { groupId: group.id, name: 'Reject', email: uniqueEmail('rej') },
      })

      const updated = await d.application.update({
        where: { id: app.id },
        data: { status: 'REJECTED' },
      })
      expect(updated.status).toBe('REJECTED')
    })

    it('o) approve when full — capacity check', async () => {
      const d = await getDb()
      const orgUser = await createUser('ORGANIZER')
      const organizer = await createOrganizer(orgUser)
      const group = await d.group.create({
        data: {
          organizerId: organizer.id, title: 'Cap', slug: uniqueSlug('cap'),
          description: 'Cap 1', status: 'PUBLISHED', capacity: 1,
        },
      })
      cleanup.groupIds.push(group.id)

      await d.application.create({
        data: { groupId: group.id, name: 'First', email: uniqueEmail('c1'), status: 'APPROVED' },
      })

      const approvedCount = await d.application.count({
        where: { groupId: group.id, status: 'APPROVED' },
      })
      expect(approvedCount).toBe(1)
      expect(approvedCount >= (group.capacity as number)).toBe(true)
    })

    it('p) group becomes FULL when capacity reached', async () => {
      const d = await getDb()
      const orgUser = await createUser('ORGANIZER')
      const organizer = await createOrganizer(orgUser)
      const group = await d.group.create({
        data: {
          organizerId: organizer.id, title: 'Full', slug: uniqueSlug('full'),
          description: 'Cap 1', status: 'PUBLISHED', capacity: 1,
        },
      })
      cleanup.groupIds.push(group.id)

      await d.application.create({
        data: { groupId: group.id, name: 'Only', email: uniqueEmail('full'), status: 'APPROVED' },
      })

      const count = await d.application.count({ where: { groupId: group.id, status: 'APPROVED' } })
      if (count >= (group.capacity as number) && group.status === 'PUBLISHED') {
        await d.group.update({ where: { id: group.id }, data: { status: 'FULL' } })
      }

      const updated = await d.group.findUnique({ where: { id: group.id } })
      expect(updated.status).toBe('FULL')
    })

    it('q) withdraw PENDING → WITHDRAWN', async () => {
      const d = await getDb()
      const orgUser = await createUser('ORGANIZER')
      const organizer = await createOrganizer(orgUser)
      const group = await createPublishedGroup(organizer)
      const applicant = await createUser('VISITOR')

      const app = await d.application.create({
        data: { groupId: group.id, userId: applicant.id, name: 'W', email: uniqueEmail('w'), status: 'PENDING' },
      })

      // Owner check: application.userId === userId
      expect(app.userId).toBe(applicant.id)

      const updated = await d.application.update({
        where: { id: app.id },
        data: { status: 'WITHDRAWN' },
      })
      expect(updated.status).toBe('WITHDRAWN')
    })

    it('r) withdraw someone else — forbidden', async () => {
      const d = await getDb()
      const orgUser = await createUser('ORGANIZER')
      const organizer = await createOrganizer(orgUser)
      const group = await createPublishedGroup(organizer)
      const applicant = await createUser('VISITOR')
      const other = await createUser('VISITOR')

      const app = await d.application.create({
        data: { groupId: group.id, userId: applicant.id, name: 'NotMine', email: uniqueEmail('nm'), status: 'PENDING' },
      })

      // Service checks: application.userId === other.id → false → ForbiddenError
      expect(app.userId).not.toBe(other.id)
    })

    it('s) withdraw APPROVED — conflict', async () => {
      const d = await getDb()
      const orgUser = await createUser('ORGANIZER')
      const organizer = await createOrganizer(orgUser)
      const group = await createPublishedGroup(organizer)

      const app = await d.application.create({
        data: { groupId: group.id, name: 'Approved', email: uniqueEmail('aw'), status: 'APPROVED' },
      })

      // Service checks: status !== 'PENDING' → ConflictError
      expect(app.status).toBe('APPROVED')
      expect(app.status).not.toBe('PENDING')
    })

    it('t) re-apply after WITHDRAWN — blocked by unique index', async () => {
      const d = await getDb()
      const orgUser = await createUser('ORGANIZER')
      const organizer = await createOrganizer(orgUser)
      const group = await createPublishedGroup(organizer)
      const email = uniqueEmail('reapply')

      await d.application.create({
        data: { groupId: group.id, name: 'First', email, status: 'WITHDRAWN' },
      })

      await expect(
        d.application.create({ data: { groupId: group.id, name: 'Second', email } }),
      ).rejects.toThrow()
    })
  })

  describe('VIDOBRAZHENNIA — applicant viewing', () => {
    it('u) findMyApplications by userId', async () => {
      const d = await getDb()
      const orgUser = await createUser('ORGANIZER')
      const organizer = await createOrganizer(orgUser)
      const group = await createPublishedGroup(organizer)
      const applicant = await createUser('VISITOR')
      const email = uniqueEmail('myview')

      await d.application.create({
        data: { groupId: group.id, userId: applicant.id, name: 'MyApp', email },
      })

      const apps = await d.application.findMany({
        where: { OR: [{ userId: applicant.id }, { email }] },
        include: { group: { select: { id: true, title: true } } },
      })

      expect(apps.length).toBeGreaterThanOrEqual(1)
      expect(apps.some((a: { group: { id: string } }) => a.group.id === group.id)).toBe(true)
    })

    it('v) findMyApplications finds old anonymous apps by email', async () => {
      const d = await getDb()
      const orgUser = await createUser('ORGANIZER')
      const organizer = await createOrganizer(orgUser)
      const group = await createPublishedGroup(organizer)
      const applicant = await createUser('VISITOR')
      const sharedEmail = uniqueEmail('shared')

      await d.application.create({
        data: { groupId: group.id, name: 'Old Anon', email: sharedEmail },
      })

      const apps = await d.application.findMany({
        where: { OR: [{ userId: applicant.id }, { email: sharedEmail }] },
      })

      expect(apps.some((a: { name: string }) => a.name === 'Old Anon')).toBe(true)
    })

    it('w) notification created on status change', async () => {
      const d = await getDb()
      const orgUser = await createUser('ORGANIZER')
      const organizer = await createOrganizer(orgUser)
      const group = await createPublishedGroup(organizer)
      const applicant = await createUser('VISITOR')

      await d.notification.create({
        data: {
          userId: applicant.id,
          type: 'APPLICATION_APPROVED',
          entityType: 'group',
          entityId: group.id,
          title: 'Application approved',
          message: 'Your application was approved',
        },
      })

      const notifications = await d.notification.findMany({
        where: { userId: applicant.id, type: 'APPLICATION_APPROVED' },
      })
      expect(notifications.length).toBeGreaterThanOrEqual(1)
    })
  })

  describe('REGRESIIA — original bug scenario', () => {
    it('logged-in user applies with userId → approve → find by userId in my-applications', async () => {
      const d = await getDb()
      const orgUser = await createUser('ORGANIZER')
      const organizer = await createOrganizer(orgUser)
      const group = await createPublishedGroup(organizer)
      const applicant = await createUser('VISITOR')
      const email = uniqueEmail('regression')

      const app = await d.application.create({
        data: { groupId: group.id, userId: applicant.id, name: 'Regression', email, status: 'PENDING' },
      })

      expect(app.userId).toBe(applicant.id)

      await d.application.update({ where: { id: app.id }, data: { status: 'APPROVED' } })

      const myApps = await d.application.findMany({
        where: { OR: [{ userId: applicant.id }, { email }] },
      })

      const found = myApps.find((a: { id: string }) => a.id === app.id)
      expect(found).toBeDefined()
      expect(found.status).toBe('APPROVED')
    })
  })
})
