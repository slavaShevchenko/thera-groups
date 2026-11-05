import { it, expect, afterAll, beforeAll, vi } from 'vitest'
import { createEvent } from 'h3'
import { describeIntegration, testConnectionString } from './_guard'

const connectionString = testConnectionString()

const { deliverMock, authUsers } = vi.hoisted(() => ({
  deliverMock: vi.fn(),
  authUsers: [] as string[],
}))

// No message may reach Resend from a test run, so the transport is replaced wholesale.
// `resolveEmailConfig` stays real: SITE_URL still drives the rendered links.
vi.mock('~~/server/services/email/transport', async (importOriginal) => {
  const actual = await importOriginal<typeof import('~~/server/services/email/transport')>()
  return { ...actual, deliver: deliverMock }
})

// Registration's Supabase half is faked; its database half stays real, which is the part
// that has to produce the welcome EmailEvent.
vi.mock('~~/server/utils/supabase', async (importOriginal) => {
  const actual = await importOriginal<typeof import('~~/server/utils/supabase')>()

  return {
    ...actual,
    createAdminClient: () => ({
      auth: {
        admin: {
          createUser: async ({ email }: { email: string }) => {
            const id = `auth-it-${authUsers.length + 1}`
            authUsers.push(id)
            return { data: { user: { id, email } }, error: null }
          },
          deleteUser: async () => ({ data: null, error: null }),
        },
      },
    }),
  }
})

vi.mock('~~/server/utils/rateLimit', async (importOriginal) => {
  const actual = await importOriginal<typeof import('~~/server/utils/rateLimit')>()
  return { ...actual, useRateLimiter: vi.fn() }
})

// The verify endpoint reads the session; the moderation itself stays real.
vi.mock('~~/server/utils/auth', () => ({
  requireAuth: vi.fn(async () => ({ id: 'admin-it', role: 'ADMIN', email: 'admin-it@test.com' })),
}))
vi.mock('~~/server/utils/permissions', () => ({ requirePermission: vi.fn() }))

/**
 * Both admin fan-outs are stubbed. They write one Notification and one EmailEvent per ADMIN
 * row in the database, and on a shared database those are real people's accounts; the
 * fan-out itself already has integration coverage in `email-flow.test.ts`. Everything the
 * five scenarios below assert stays real.
 */
vi.mock('~~/server/utils/notifications', async (importOriginal) => {
  const actual = await importOriginal<typeof import('~~/server/utils/notifications')>()

  return {
    ...actual,
    notifyAdminsGroupPendingReview: vi.fn(),
    notifyAdminsOrganizerPendingReview: vi.fn(),
  }
})

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let db: any
// server/utils/prisma.ts reads DATABASE_URL at import time; see beforeAll.
let originalDatabaseUrl: string | undefined

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let real: Record<string, any> | null = null

const cleanup = { userIds: [] as string[], groupIds: [] as string[], emails: [] as string[] }

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

function unique(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function uniqueEmail(prefix: string) {
  const email = `${unique(prefix)}@test.com`
  cleanup.emails.push(email)
  return email
}

/**
 * Fire-and-forget sends settle outside the awaited call, so poll instead of sleeping. The
 * row is written as PENDING before the first delivery attempt, so waiting for it to exist
 * is not enough — wait for the outcome to land.
 */
async function waitForEmail(recipient: string, template: string, timeoutMs = 8000) {
  const deadline = Date.now() + timeoutMs

  for (;;) {
    const row = await db.emailEvent.findFirst({
      where: { recipient, template, status: { not: 'PENDING' } },
    })
    if (row) return row
    if (Date.now() > deadline) {
      throw new Error(`Timed out waiting for the ${template} email to ${recipient}`)
    }
    await new Promise(resolve => setTimeout(resolve, 50))
  }
}

async function createOrganizer(verificationStatus = 'VERIFIED', locale = 'ua') {
  const d = await getDb()
  const email = uniqueEmail('organizer')
  const user = await d.user.create({
    data: { email, role: 'ORGANIZER', preferredLocale: locale },
  })
  cleanup.userIds.push(user.id)

  const profile = await d.organizerProfile.create({
    data: {
      userId: user.id,
      slug: unique('org'),
      firstName: 'Олена',
      lastName: 'Коваленко',
      verificationStatus,
    },
  })

  return { user, profile }
}

async function createGroup(organizerId: string, status: string) {
  const d = await getDb()
  const group = await d.group.create({
    data: {
      organizerId,
      title: 'Група підтримки',
      slug: unique('group'),
      description: 'Опис тестової групи',
      status,
    },
  })
  cleanup.groupIds.push(group.id)
  return group
}

function makeEvent(method: 'POST' | 'PATCH', url: string, params: Record<string, string>, body?: unknown) {
  const event = createEvent({ url, method, headers: { 'content-type': 'application/json' } }, {})
  event.context.params = params
  if (body !== undefined) event._requestBody = JSON.stringify(body)
  return event
}

describeIntegration('Phase 1 notification emails — integration', () => {
  beforeAll(async () => {
    await getDb()

    originalDatabaseUrl = process.env.DATABASE_URL
    process.env.DATABASE_URL = connectionString!

    // Undo tests/setup.ts so the services and handlers reach the real database.
    delete (globalThis as Record<string, unknown>).prisma
    vi.doUnmock('~~/server/utils/prisma')
    vi.resetModules()

    const [applicationService, groupService, prismaModule, registerHandler, moderateHandler]
      = await Promise.all([
        import('~~/server/services/applicationService'),
        import('~~/server/services/groupService'),
        import('~~/server/utils/prisma'),
        import('~~/server/api/auth/register.post'),
        import('~~/server/api/admin/organizer-profiles/[id].patch'),
      ])

    real = {
      applicationService: applicationService.applicationService,
      groupService: groupService.groupService,
      prisma: prismaModule.prisma,
      register: registerHandler.default,
      moderate: moderateHandler.default,
    }

    deliverMock.mockResolvedValue({ status: 'sent', attempts: 1, providerId: 're_phase1' })
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
        await db.application.deleteMany({ where: { groupId: { in: cleanup.groupIds } } }).catch(() => {})
        await db.group.deleteMany({ where: { id: { in: cleanup.groupIds } } }).catch(() => {})
      }
      if (cleanup.userIds.length) {
        await db.notification.deleteMany({ where: { userId: { in: cleanup.userIds } } }).catch(() => {})
        await db.organizerProfile.deleteMany({ where: { userId: { in: cleanup.userIds } } }).catch(() => {})
        await db.user.deleteMany({ where: { id: { in: cleanup.userIds } } }).catch(() => {})
      }
      await db.$disconnect()
    }
  })

  it('h) applying emails the applicant an acknowledgement', async () => {
    const { profile } = await createOrganizer()
    const group = await createGroup(profile.id, 'PUBLISHED')
    const applicantEmail = uniqueEmail('applicant')

    await real!.applicationService.create(group.slug, {
      name: 'Іван Петренко',
      email: applicantEmail,
      answers: [],
    })

    const row = await waitForEmail(applicantEmail, 'application_submitted')

    expect(row).toMatchObject({
      status: 'SENT',
      type: 'APPLICATION_SUBMITTED',
      locale: 'ua',
      entityId: group.slug,
    })
  })

  it('i) registering an ORGANIZER emails them a welcome', async () => {
    const email = uniqueEmail('signup')

    const result = await real!.register(makeEvent('POST', '/api/auth/register', {}, {
      email,
      password: 'password123',
      role: 'ORGANIZER',
      preferredLocale: 'en',
      organizerData: {
        firstName: 'Ivan',
        lastName: 'Petrenko',
        // Required by `registerSchema.organizerData`: without them `moderateProfile` could
        // never verify the profile this sign-up opens.
        qualification: 'Магістр психології',
        professionalOrganization: 'Українська спілка психотерапевтів',
        professionalOrganizationStatus: 'Дійсний член',
      },
    })) as { success: boolean, user: { id: string } }

    expect(result.success).toBe(true)
    cleanup.userIds.push(result.user.id)

    const row = await waitForEmail(email, 'organizer_welcome')

    expect(row).toMatchObject({
      status: 'SENT',
      type: 'ORGANIZER_WELCOME',
      locale: 'en',
    })
    expect(row.entityId).toBeTruthy()

    const notification = await db.notification.findFirst({
      where: { userId: result.user.id, type: 'ORGANIZER_WELCOME' },
    })
    expect(notification).not.toBeNull()
  })

  it('j) submitting a group for moderation emails the owner', async () => {
    const { user, profile } = await createOrganizer()
    const group = await createGroup(profile.id, 'DRAFT')

    await real!.groupService.updateGroup(
      group.slug,
      { status: 'PENDING_REVIEW' },
      { userId: user.id, role: 'ORGANIZER', isAdmin: false },
    )

    const row = await waitForEmail(user.email, 'group_submitted')

    expect(row).toMatchObject({
      status: 'SENT',
      type: 'GROUP_SUBMITTED',
      entityId: group.slug,
    })

    const notification = await db.notification.findFirst({
      where: { userId: user.id, type: 'GROUP_SUBMITTED' },
    })
    expect(notification).not.toBeNull()
  })

  it('k) editing a critical field on a PUBLISHED group emails the owner about the revert', async () => {
    const { user, profile } = await createOrganizer('VERIFIED', 'en')
    const group = await createGroup(profile.id, 'PUBLISHED')

    const result = await real!.groupService.updateGroup(
      group.slug,
      { title: 'Renamed by the integration test' },
      { userId: user.id, role: 'ORGANIZER', isAdmin: false },
    )

    expect(result.group.status).toBe('PENDING_REVIEW')

    const row = await waitForEmail(user.email, 'group_auto_revert')

    expect(row).toMatchObject({
      status: 'SENT',
      type: 'GROUP_AUTO_REVERT',
      locale: 'en',
      entityId: group.slug,
    })

    const notification = await db.notification.findFirst({
      where: { userId: user.id, type: 'GROUP_AUTO_REVERT' },
    })
    expect(notification).not.toBeNull()
  })

  it('l) the admin moderation route emails the organizer', async () => {
    const { user, profile } = await createOrganizer('PENDING')

    const result = await real!.moderate(
      makeEvent('PATCH', `/api/admin/organizer-profiles/${profile.id}`, { id: profile.id }, {
        verificationStatus: 'VERIFIED',
      }),
    ) as { verificationStatus: string }

    expect(result.verificationStatus).toBe('VERIFIED')

    const row = await waitForEmail(user.email, 'organizer_verified')

    expect(row).toMatchObject({
      status: 'SENT',
      type: 'ORGANIZER_APPROVED',
      entityId: profile.slug,
    })

    const notification = await db.notification.findFirst({
      where: { userId: user.id, type: 'ORGANIZER_APPROVED' },
    })
    expect(notification).not.toBeNull()
  })
})
