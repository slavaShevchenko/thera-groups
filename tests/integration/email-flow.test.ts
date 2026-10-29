import { it, expect, afterAll, beforeAll, vi } from 'vitest'
import { describeIntegration, testConnectionString } from './_guard'

const connectionString = testConnectionString()

const { deliverMock } = vi.hoisted(() => ({ deliverMock: vi.fn() }))

// No message may reach Resend from a test run, so the transport is replaced wholesale.
// `resolveEmailConfig` stays real: SITE_URL still drives the rendered links.
vi.mock('~~/server/services/email/transport', async (importOriginal) => {
  const actual = await importOriginal<typeof import('~~/server/services/email/transport')>()
  return { ...actual, deliver: deliverMock }
})

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let db: any
// server/utils/prisma.ts reads DATABASE_URL at import time; see beforeAll.
let originalDatabaseUrl: string | undefined
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let real: { sendEmail: any, notifyApplicationStatusChanged: any, prisma: any } | null = null

const cleanup = { userIds: [] as string[], emails: [] as string[] }

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
  const email = `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}@test.com`
  cleanup.emails.push(email)
  return email
}

/** Fire-and-forget sends settle outside the awaited call, so poll instead of sleeping. */
async function waitFor<T>(probe: () => Promise<T | null>, timeoutMs = 5000): Promise<T> {
  const deadline = Date.now() + timeoutMs

  for (;;) {
    const value = await probe()
    if (value) return value
    if (Date.now() > deadline) throw new Error('Timed out waiting for the email row')
    await new Promise(resolve => setTimeout(resolve, 50))
  }
}

describeIntegration('Email service — integration', () => {
  beforeAll(async () => {
    await getDb()

    originalDatabaseUrl = process.env.DATABASE_URL
    process.env.DATABASE_URL = connectionString!

    // Undo tests/setup.ts so the service and notifications reach the real database.
    delete (globalThis as Record<string, unknown>).prisma
    vi.doUnmock('~~/server/utils/prisma')
    vi.resetModules()

    const [emailModule, notificationsModule, prismaModule] = await Promise.all([
      import('~~/server/services/email'),
      import('~~/server/utils/notifications'),
      import('~~/server/utils/prisma'),
    ])
    real = {
      sendEmail: emailModule.sendEmail,
      notifyApplicationStatusChanged: notificationsModule.notifyApplicationStatusChanged,
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
      if (cleanup.userIds.length) {
        await db.notification.deleteMany({ where: { userId: { in: cleanup.userIds } } }).catch(() => {})
        await db.user.deleteMany({ where: { id: { in: cleanup.userIds } } }).catch(() => {})
      }
      await db.$disconnect()
    }
  })

  it('j) sendEmail writes EmailEvent PENDING → SENT against a mocked transport', async () => {
    const recipient = uniqueEmail('sendemail')
    let statusDuringDelivery: string | null = null

    deliverMock.mockImplementation(async () => {
      const row = await db.emailEvent.findFirst({
        where: { recipient },
        select: { status: true },
      })
      statusDuringDelivery = row?.status ?? null
      return { status: 'sent', attempts: 1, providerId: 're_integration_1' }
    })

    await real!.sendEmail({
      to: recipient,
      template: 'application_approved',
      locale: 'en',
      data: { groupTitle: 'Integration group', groupSlug: 'integration-group' },
      entityId: 'integration-group',
    })

    // The row must already exist, still queued, while the transport is running.
    expect(statusDuringDelivery).toBe('PENDING')

    const row = await db.emailEvent.findFirst({ where: { recipient } })

    expect(row).toMatchObject({
      status: 'SENT',
      providerId: 're_integration_1',
      template: 'application_approved',
      type: 'APPLICATION_APPROVED',
      locale: 'en',
      entityId: 'integration-group',
      error: null,
      // Production-path rows must not carry the rendered body.
      html: null,
    })
    expect(row.sentAt).toBeInstanceOf(Date)
  })

  it('k) notifyApplicationStatusChanged writes a Notification and an EmailEvent', async () => {
    const applicantEmail = uniqueEmail('applicant')
    const d = await getDb()

    const applicant = await d.user.create({
      data: { email: applicantEmail, role: 'VISITOR', preferredLocale: 'ua' },
    })
    cleanup.userIds.push(applicant.id)

    deliverMock.mockResolvedValue({ status: 'sent', attempts: 1, providerId: 're_integration_2' })

    await real!.notifyApplicationStatusChanged(
      applicantEmail,
      'Група підтримки',
      'support-group',
      'APPROVED',
    )

    const notification = await d.notification.findFirst({
      where: { userId: applicant.id, type: 'APPLICATION_APPROVED' },
    })
    expect(notification).not.toBeNull()
    // The slug, matching the email's own entityId: `notificationRoute` turns this into
    // `/groups/<entityId>`, which only resolves for a slug.
    expect(notification!.entityId).toBe('support-group')
    expect(notification!.title).toContain('схвалено')

    const emailRow = await waitFor(() =>
      d.emailEvent.findFirst({ where: { recipient: applicantEmail } }))

    expect(emailRow).toMatchObject({
      status: 'SENT',
      template: 'application_approved',
      type: 'APPLICATION_APPROVED',
      locale: 'ua',
      entityId: 'support-group',
    })
  })
})
