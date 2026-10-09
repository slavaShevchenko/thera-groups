import { it, expect, afterAll, beforeAll, vi } from 'vitest'
import { describeIntegration, testConnectionString } from './_guard'

const connectionString = testConnectionString()

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let db: any
// server/utils/prisma.ts reads DATABASE_URL at import time; see beforeAll.
let originalDatabaseUrl: string | undefined

// tests/setup.ts mocks ~~/server/utils/prisma and seeds globalThis.prisma with that mock
// for every file, so the real services have to be imported after both are undone.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let real: { applicationService: any, groupService: any, prisma: any } | null = null

const cleanup = {
  userIds: [] as string[],
  groupIds: [] as string[],
  organizerIds: [] as string[],
  emails: [] as string[],
}

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
  const email = `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}@test.com`
  cleanup.emails.push(email)
  return email
}

async function createOrganizerUser() {
  const d = await getDb()
  const user = await d.user.create({ data: { email: uniqueEmail('lifecycle-org'), role: 'ORGANIZER' } })
  cleanup.userIds.push(user.id)

  const organizer = await d.organizerProfile.create({
    data: {
      userId: user.id,
      slug: uniqueSlug('lifecycle-org'),
      firstName: 'Test',
      lastName: 'Org',
      verificationStatus: 'VERIFIED',
    },
  })
  cleanup.organizerIds.push(organizer.id)

  return { user, organizer }
}

async function createGroup(
  organizerId: string,
  overrides: Record<string, unknown> = {},
) {
  const d = await getDb()
  const group = await d.group.create({
    data: {
      organizerId,
      title: 'Lifecycle group',
      slug: uniqueSlug('lifecycle-g'),
      description: 'Temp group for the lifecycle regression suite',
      status: 'PUBLISHED',
      startsAt: new Date('2030-01-10T17:00:00.000Z'),
      endsAt: new Date('2030-02-10T17:00:00.000Z'),
      ...overrides,
    },
  })
  cleanup.groupIds.push(group.id)
  return group
}

async function createApplication(groupId: string, status: string, email?: string) {
  const d = await getDb()
  const application = await d.application.create({
    data: {
      groupId,
      name: 'Applicant',
      email: email ?? uniqueEmail('lifecycle-app'),
      status,
    },
  })
  return application
}

async function readGroup(id: string) {
  const d = await getDb()
  return d.group.findUnique({ where: { id }, select: { status: true, capacity: true } })
}

describeIntegration('Group lifecycle — integration', () => {
  beforeAll(async () => {
    await getDb()

    // The services build their own client from DATABASE_URL, so it has to point at the
    // test database before the modules load — otherwise the fixtures land in one database
    // and the service reads another.
    originalDatabaseUrl = process.env.DATABASE_URL
    process.env.DATABASE_URL = connectionString!

    delete (globalThis as Record<string, unknown>).prisma
    vi.doUnmock('~~/server/utils/prisma')
    vi.resetModules()

    const [applicationModule, groupModule, prismaModule] = await Promise.all([
      import('~~/server/services/applicationService'),
      import('~~/server/services/groupService'),
      import('~~/server/utils/prisma'),
    ])
    real = {
      applicationService: applicationModule.applicationService,
      groupService: groupModule.groupService,
      prisma: prismaModule.prisma,
    }
  })

  afterAll(async () => {
    if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL
    else process.env.DATABASE_URL = originalDatabaseUrl

    await real?.prisma.$disconnect().catch(() => {})
    if (db) {
      if (cleanup.emails.length) {
        await db.emailEvent.deleteMany({ where: { recipient: { in: cleanup.emails } } }).catch(() => {})
      }
      if (cleanup.groupIds.length) {
        await db.applicationAnswer.deleteMany({
          where: { application: { groupId: { in: cleanup.groupIds } } },
        }).catch(() => {})
        await db.application.deleteMany({ where: { groupId: { in: cleanup.groupIds } } }).catch(() => {})
        await db.applicationQuestion.deleteMany({ where: { groupId: { in: cleanup.groupIds } } }).catch(() => {})
        await db.favorite.deleteMany({ where: { groupId: { in: cleanup.groupIds } } }).catch(() => {})
        await db.group.deleteMany({ where: { id: { in: cleanup.groupIds } } }).catch(() => {})
      }
      if (cleanup.userIds.length) {
        await db.groupCoOrganizer.deleteMany({ where: { userId: { in: cleanup.userIds } } }).catch(() => {})
        await db.notification.deleteMany({ where: { userId: { in: cleanup.userIds } } }).catch(() => {})
        await db.user.deleteMany({ where: { id: { in: cleanup.userIds } } }).catch(() => {})
      }
      if (cleanup.organizerIds.length) {
        await db.organizerProfile.deleteMany({ where: { id: { in: cleanup.organizerIds } } }).catch(() => {})
      }
      await db.$disconnect()
    }
  })

  describe('applying to a group that is visible but closed', () => {
    it('refuses a FULL group with GROUP_FULL', async () => {
      const { organizer } = await createOrganizerUser()
      const group = await createGroup(organizer.id, { status: 'FULL', capacity: 1 })

      await expect(
        real!.applicationService.create(group.slug, {
          name: 'Applicant',
          email: uniqueEmail('lifecycle-full'),
          phone: '+380501234567',
          answers: [],
        }),
      ).rejects.toMatchObject({ code: 'GROUP_FULL' })
    })

    it('refuses a COMPLETED group with GROUP_ENDED', async () => {
      const { organizer } = await createOrganizerUser()
      const group = await createGroup(organizer.id, { status: 'COMPLETED' })

      await expect(
        real!.applicationService.create(group.slug, {
          name: 'Applicant',
          email: uniqueEmail('lifecycle-done'),
          phone: '+380501234567',
          answers: [],
        }),
      ).rejects.toMatchObject({ code: 'GROUP_ENDED' })
    })

    it('refuses a group whose endsAt has passed even while the row still says PUBLISHED', async () => {
      // Nothing moves a row to COMPLETED automatically, so the date is the only thing
      // that closes it. Before this guard a group that ran last month kept taking
      // applications indefinitely.
      const { organizer } = await createOrganizerUser()
      const group = await createGroup(organizer.id, {
        status: 'PUBLISHED',
        startsAt: new Date('2020-01-10T17:00:00.000Z'),
        endsAt: new Date('2020-02-10T17:00:00.000Z'),
      })

      await expect(
        real!.applicationService.create(group.slug, {
          name: 'Applicant',
          email: uniqueEmail('lifecycle-past'),
          phone: '+380501234567',
          answers: [],
        }),
      ).rejects.toMatchObject({ code: 'GROUP_ENDED' })
    })

    it('answers NOT_FOUND for a CANCELLED group rather than revealing it exists', async () => {
      const { organizer } = await createOrganizerUser()
      const group = await createGroup(organizer.id, { status: 'CANCELLED' })

      await expect(
        real!.applicationService.create(group.slug, {
          name: 'Applicant',
          email: uniqueEmail('lifecycle-cancelled'),
          phone: '+380501234567',
          answers: [],
        }),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' })
    })

    it('accepts an application on a PUBLISHED group that has not ended', async () => {
      const { organizer } = await createOrganizerUser()
      const group = await createGroup(organizer.id)

      const result = await real!.applicationService.create(group.slug, {
        name: 'Applicant',
        email: uniqueEmail('lifecycle-ok'),
        phone: '+380501234567',
        answers: [],
      })

      expect(result.application.status).toBe('PENDING')
    })
  })

  describe('seats moving a group in and out of FULL', () => {
    it('marks the group FULL when the last seat is approved', async () => {
      const { organizer, user } = await createOrganizerUser()
      const group = await createGroup(organizer.id, { capacity: 1 })
      const application = await createApplication(group.id, 'PENDING')

      await real!.applicationService.updateStatus(
        group.slug,
        application.id,
        'APPROVED',
        { userId: user.id, role: 'ORGANIZER' },
      )

      expect((await readGroup(group.id)).status).toBe('FULL')
    })

    it('refuses the approval that would pass capacity', async () => {
      const { organizer, user } = await createOrganizerUser()
      const group = await createGroup(organizer.id, { capacity: 1 })
      const seated = await createApplication(group.id, 'PENDING')
      const waiting = await createApplication(group.id, 'PENDING')

      await real!.applicationService.updateStatus(
        group.slug, seated.id, 'APPROVED', { userId: user.id, role: 'ORGANIZER' },
      )

      await expect(
        real!.applicationService.updateStatus(
          group.slug, waiting.id, 'APPROVED', { userId: user.id, role: 'ORGANIZER' },
        ),
      ).rejects.toMatchObject({ code: 'GROUP_FULL' })
    })

    it('seats exactly the capacity when approvals are fired at the same group at once', async () => {
      // The unit test models the lock; this one pays for a real connection each and lets
      // Postgres actually serialize them. `SELECT ... FOR UPDATE` is the only thing
      // standing between this and a group booked past its capacity with no error anywhere.
      const capacity = 3
      const { organizer, user } = await createOrganizerUser()
      const group = await createGroup(organizer.id, { capacity })
      const applications = await Promise.all(
        Array.from({ length: capacity * 2 }, () => createApplication(group.id, 'PENDING')),
      )

      const outcomes = await Promise.allSettled(
        applications.map(application => real!.applicationService.updateStatus(
          group.slug,
          application.id,
          'APPROVED',
          { userId: user.id, role: 'ORGANIZER' },
        )),
      )

      const approved = outcomes.filter(o => o.status === 'fulfilled')
      const refused = outcomes.filter(o => o.status === 'rejected')

      expect(approved).toHaveLength(capacity)
      expect(refused).toHaveLength(capacity)
      for (const failure of refused) {
        expect((failure as PromiseRejectedResult).reason).toMatchObject({ code: 'GROUP_FULL' })
      }

      const d = await getDb()
      const seated = await d.application.count({ where: { groupId: group.id, status: 'APPROVED' } })
      expect(seated).toBe(capacity)
      expect((await readGroup(group.id)).status).toBe('FULL')
    })

    it('reopens a FULL group when rejecting an approved applicant frees the seat', async () => {
      // The only way out of FULL. Without it a full group stayed full forever, because the
      // capacity check refuses the very approval that would have triggered a recount.
      const { organizer, user } = await createOrganizerUser()
      const group = await createGroup(organizer.id, { capacity: 1 })
      const application = await createApplication(group.id, 'PENDING')

      await real!.applicationService.updateStatus(
        group.slug, application.id, 'APPROVED', { userId: user.id, role: 'ORGANIZER' },
      )
      expect((await readGroup(group.id)).status).toBe('FULL')

      await real!.applicationService.updateStatus(
        group.slug, application.id, 'REJECTED', { userId: user.id, role: 'ORGANIZER' },
      )

      expect((await readGroup(group.id)).status).toBe('PUBLISHED')
    })

    it('reopens a FULL group when the owner raises the capacity', async () => {
      const { organizer, user } = await createOrganizerUser()
      const group = await createGroup(organizer.id, { capacity: 1 })
      await createApplication(group.id, 'APPROVED')
      expect((await readGroup(group.id)).status).toBe('PUBLISHED')

      await db.group.update({ where: { id: group.id }, data: { status: 'FULL' } })

      await real!.groupService.updateGroup(
        group.slug,
        { maxParticipants: 3 },
        { userId: user.id, role: 'ORGANIZER', isAdmin: false },
      )

      expect((await readGroup(group.id)).status).toBe('PUBLISHED')
    })
  })

  describe('ending a group', () => {
    it('lets the owner complete a published group', async () => {
      const { organizer, user } = await createOrganizerUser()
      const group = await createGroup(organizer.id)

      await real!.groupService.updateGroup(
        group.slug,
        { status: 'COMPLETED' },
        { userId: user.id, role: 'ORGANIZER', isAdmin: false },
      )

      expect((await readGroup(group.id)).status).toBe('COMPLETED')
    })

    it('lets the owner cancel a published group', async () => {
      const { organizer, user } = await createOrganizerUser()
      const group = await createGroup(organizer.id)

      await real!.groupService.updateGroup(
        group.slug,
        { status: 'CANCELLED' },
        { userId: user.id, role: 'ORGANIZER', isAdmin: false },
      )

      expect((await readGroup(group.id)).status).toBe('CANCELLED')
    })

    it('notifies the owner and every approved applicant that the group was cancelled', async () => {
      const { organizer, user } = await createOrganizerUser()
      const group = await createGroup(organizer.id)
      const approvedEmail = uniqueEmail('lifecycle-approved')
      await createApplication(group.id, 'APPROVED', approvedEmail)
      await createApplication(group.id, 'PENDING')
      await createApplication(group.id, 'REJECTED')

      await real!.groupService.updateGroup(
        group.slug,
        { status: 'CANCELLED' },
        { userId: user.id, role: 'ORGANIZER', isAdmin: false },
      )

      const d = await getDb()
      const notifications = await d.notification.findMany({
        where: { userId: user.id, type: 'GROUP_CANCELLED', entityId: group.slug },
      })
      expect(notifications.length).toBeGreaterThan(0)

      // Only the approved applicant is told: a pending one never held a seat and a
      // rejected one already had their own decision letter.
      const cancelledEmails = await d.emailEvent.findMany({
        where: { template: 'group_cancelled', recipient: { in: cleanup.emails } },
      })
      const recipients = cancelledEmails.map((e: { recipient: string }) => e.recipient)
      expect(recipients).toContain(approvedEmail)
    })

    it('treats COMPLETED as terminal', async () => {
      const { organizer, user } = await createOrganizerUser()
      const group = await createGroup(organizer.id, { status: 'COMPLETED' })

      await expect(
        real!.groupService.updateGroup(
          group.slug,
          { status: 'CANCELLED' },
          { userId: user.id, role: 'ORGANIZER', isAdmin: false },
        ),
      ).rejects.toMatchObject({ code: 'VALIDATION_FAILED' })

      expect((await readGroup(group.id)).status).toBe('COMPLETED')
    })
  })

  describe('deleting a group', () => {
    it('refuses while an approved applicant still holds a seat', async () => {
      // Application.groupId cascades, so this used to take every application, answer and
      // question with it and tell nobody.
      const { organizer, user } = await createOrganizerUser()
      const group = await createGroup(organizer.id, { status: 'REJECTED' })
      await createApplication(group.id, 'APPROVED')

      await expect(
        real!.groupService.deleteGroup(group.slug, { userId: user.id, role: 'ORGANIZER' }),
      ).rejects.toMatchObject({ code: 'HAS_APPLICATIONS' })

      const d = await getDb()
      expect(await d.group.findUnique({ where: { id: group.id } })).not.toBeNull()
    })

    it('refuses while an applicant is still waiting on a decision', async () => {
      const { organizer, user } = await createOrganizerUser()
      const group = await createGroup(organizer.id, { status: 'REJECTED' })
      await createApplication(group.id, 'PENDING')

      await expect(
        real!.groupService.deleteGroup(group.slug, { userId: user.id, role: 'ORGANIZER' }),
      ).rejects.toMatchObject({ code: 'HAS_APPLICATIONS' })
    })

    it('deletes a draft nobody ever applied to', async () => {
      const { organizer, user } = await createOrganizerUser()
      const group = await createGroup(organizer.id, { status: 'DRAFT' })

      await expect(
        real!.groupService.deleteGroup(group.slug, { userId: user.id, role: 'ORGANIZER' }),
      ).resolves.toEqual({ success: true })

      const d = await getDb()
      expect(await d.group.findUnique({ where: { id: group.id } })).toBeNull()
      cleanup.groupIds.splice(cleanup.groupIds.indexOf(group.id), 1)
    })

    it('deletes a rejected group whose applicants all withdrew', async () => {
      const { organizer, user } = await createOrganizerUser()
      const group = await createGroup(organizer.id, { status: 'REJECTED' })
      await createApplication(group.id, 'WITHDRAWN')
      await createApplication(group.id, 'REJECTED')

      await expect(
        real!.groupService.deleteGroup(group.slug, { userId: user.id, role: 'ORGANIZER' }),
      ).resolves.toEqual({ success: true })

      cleanup.groupIds.splice(cleanup.groupIds.indexOf(group.id), 1)
    })

    it('refuses a co-organizer, who may edit but not destroy', async () => {
      const { organizer } = await createOrganizerUser()
      const group = await createGroup(organizer.id, { status: 'DRAFT' })

      const d = await getDb()
      const coUser = await d.user.create({ data: { email: uniqueEmail('lifecycle-co'), role: 'ORGANIZER' } })
      cleanup.userIds.push(coUser.id)
      await d.groupCoOrganizer.create({
        data: { groupId: group.id, userId: coUser.id, role: 'CO_ORGANIZER' },
      })

      await expect(
        real!.groupService.deleteGroup(group.slug, { userId: coUser.id, role: 'ORGANIZER' }),
      ).rejects.toMatchObject({ code: 'FORBIDDEN' })
    })

    it('refuses to delete a published group — cancel it instead', async () => {
      const { organizer, user } = await createOrganizerUser()
      const group = await createGroup(organizer.id, { status: 'PUBLISHED' })

      await expect(
        real!.groupService.deleteGroup(group.slug, { userId: user.id, role: 'ORGANIZER' }),
      ).rejects.toMatchObject({ code: 'FORBIDDEN' })
    })
  })

  describe('what the catalog shows', () => {
    it('lists FULL and COMPLETED groups, and hides CANCELLED ones', async () => {
      const { organizer } = await createOrganizerUser()
      const full = await createGroup(organizer.id, { status: 'FULL' })
      const completed = await createGroup(organizer.id, { status: 'COMPLETED' })
      const cancelled = await createGroup(organizer.id, { status: 'CANCELLED' })

      const { groups, total } = await real!.groupService.getPublishedGroups({}, { skip: 0, take: 500 })
      const slugs = groups.map((g: { slug: string }) => g.slug)

      expect(slugs).toContain(full.slug)
      expect(slugs).toContain(completed.slug)
      expect(slugs).not.toContain(cancelled.slug)
      expect(total).toBeGreaterThanOrEqual(2)
    })

    it('keeps a started group in the catalog, behind the upcoming ones', async () => {
      // Visibility is decided by status alone now. The catalog used to filter on
      // `startsAt >= now` while the detail lookup did not, which left every indexed URL
      // for a started group pointing at a page the catalog no longer admitted.
      const { organizer } = await createOrganizerUser()
      const past = await createGroup(organizer.id, {
        startsAt: new Date('2020-01-10T17:00:00.000Z'),
        endsAt: new Date('2020-02-10T17:00:00.000Z'),
      })
      const upcoming = await createGroup(organizer.id, {
        startsAt: new Date(Date.now() + 30 * 86_400_000),
      })

      const { groups } = await real!.groupService.getPublishedGroups({}, { skip: 0, take: 500 })
      const slugs = groups.map((g: { slug: string }) => g.slug)

      expect(slugs).toContain(past.slug)
      expect(slugs.indexOf(upcoming.slug)).toBeLessThan(slugs.indexOf(past.slug))
    })
  })
})
