import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const { deliverMock } = vi.hoisted(() => ({ deliverMock: vi.fn() }))

vi.mock('~~/server/utils/prisma', () => ({ prisma: globalThis.prisma }))

// Only `deliver` is replaced: `resolveEmailConfig` stays real so the render context still
// reads SITE_URL from the environment like it does in production.
vi.mock('~~/server/services/email/transport', async (importOriginal) => {
  const actual = await importOriginal<typeof import('~~/server/services/email/transport')>()
  return { ...actual, deliver: deliverMock }
})

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- globalThis.prisma is set in test setup
const prisma = globalThis.prisma as any

// eslint-disable-next-line import/first -- import must follow vi.mock()
import { sendEmail, absoluteUrl } from '~~/server/services/email'
// eslint-disable-next-line import/first -- import must follow vi.mock()
import type { SendEmailOptions } from '~~/server/services/email'

const options = {
  to: 'applicant@example.com',
  template: 'application_approved',
  locale: 'ua',
  data: { groupTitle: 'Група підтримки', groupSlug: 'support-group' },
  entityId: 'support-group',
} as const satisfies SendEmailOptions<'application_approved'>

let errorSpy: ReturnType<typeof vi.spyOn>
let warnSpy: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  vi.clearAllMocks()
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
  prisma.emailEvent.create.mockResolvedValue({ id: 'evt_1' })
  prisma.emailEvent.update.mockResolvedValue({ id: 'evt_1' })
  deliverMock.mockResolvedValue({ status: 'sent', attempts: 1, providerId: 're_msg_1' })
})

afterEach(() => {
  errorSpy.mockRestore()
  warnSpy.mockRestore()
})

describe('sendEmail — the never-throws contract', () => {
  it('resolves to undefined on the happy path', async () => {
    await expect(sendEmail(options)).resolves.toBeUndefined()
    expect(errorSpy).not.toHaveBeenCalled()
  })

  it('resolves when the transport itself throws', async () => {
    deliverMock.mockRejectedValue(new Error('transport exploded'))

    await expect(sendEmail(options)).resolves.toBeUndefined()

    expect(prisma.emailEvent.update).toHaveBeenCalledWith({
      where: { id: 'evt_1' },
      data: { status: 'FAILED', error: 'transport exploded' },
    })
    expect(errorSpy).toHaveBeenCalled()
  })

  it('resolves when rendering fails', async () => {
    const broken = { ...options, data: { groupTitle: 'x' } } as unknown as SendEmailOptions

    await expect(sendEmail(broken)).resolves.toBeUndefined()
  })

  it('resolves for an unknown template and records a FAILED row', async () => {
    const unknown = {
      to: 'applicant@example.com',
      template: 'not_a_real_template',
      locale: 'ua',
      data: {},
    } as unknown as SendEmailOptions

    await expect(sendEmail(unknown)).resolves.toBeUndefined()

    expect(deliverMock).not.toHaveBeenCalled()
    expect(prisma.emailEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        recipient: 'applicant@example.com',
        template: 'not_a_real_template',
        status: 'FAILED',
        error: 'Unknown email template: not_a_real_template',
      }),
    })
    expect(errorSpy).toHaveBeenCalled()
  })

  it('still delivers when the tracking row cannot be written', async () => {
    prisma.emailEvent.create.mockRejectedValue(new Error('database down'))

    await expect(sendEmail(options)).resolves.toBeUndefined()

    expect(deliverMock).toHaveBeenCalledOnce()
    expect(prisma.emailEvent.update).not.toHaveBeenCalled()
  })

  it('does not mark a delivered message FAILED when the status write fails', async () => {
    prisma.emailEvent.update.mockRejectedValue(new Error('update failed'))

    await expect(sendEmail(options)).resolves.toBeUndefined()

    // Exactly one attempt: the FAILED write from the outer catch must not follow.
    expect(prisma.emailEvent.update).toHaveBeenCalledTimes(1)
    expect(errorSpy).toHaveBeenCalled()
  })
})

describe('sendEmail — tracking transitions', () => {
  it('queues as PENDING with the template, NotificationType and locale', async () => {
    await sendEmail(options)

    expect(prisma.emailEvent.create).toHaveBeenCalledWith({
      data: {
        recipient: 'applicant@example.com',
        template: 'application_approved',
        type: 'APPLICATION_APPROVED',
        locale: 'ua',
        entityId: 'support-group',
        status: 'PENDING',
      },
      select: { id: true },
    })
  })

  it('queued → SENT with the provider id', async () => {
    await sendEmail(options)

    expect(prisma.emailEvent.update).toHaveBeenCalledWith({
      where: { id: 'evt_1' },
      data: expect.objectContaining({ status: 'SENT', providerId: 're_msg_1' }),
    })
  })

  it('queued → SKIPPED with the reason when delivery is not configured', async () => {
    deliverMock.mockResolvedValue({
      status: 'skipped',
      attempts: 0,
      error: 'RESEND_API_KEY is not configured',
    })

    await sendEmail(options)

    expect(prisma.emailEvent.update).toHaveBeenCalledWith({
      where: { id: 'evt_1' },
      data: { status: 'SKIPPED', error: 'RESEND_API_KEY is not configured' },
    })
  })

  it('queued → DEV_PREVIEW storing the rendered HTML', async () => {
    deliverMock.mockResolvedValue({ status: 'dev_preview', attempts: 0 })

    await sendEmail(options)

    const call = prisma.emailEvent.update.mock.calls[0][0]

    expect(call.where).toEqual({ id: 'evt_1' })
    expect(call.data.status).toBe('DEV_PREVIEW')
    expect(call.data.error).toBeNull()
    // The service persists its own rendering rather than trusting the transport to echo
    // it back, so this is the same document that would have been sent.
    expect(call.data.html).toContain('<!doctype html>')
    expect(call.data.html).toContain('Група підтримки')
  })

  it('queued → FAILED with the delivery error', async () => {
    deliverMock.mockResolvedValue({ status: 'failed', attempts: 3, error: 'Resend is down' })

    await sendEmail(options)

    expect(prisma.emailEvent.update).toHaveBeenCalledWith({
      where: { id: 'evt_1' },
      data: { status: 'FAILED', error: 'Resend is down' },
    })
  })
})

describe('sendEmail — what reaches the transport', () => {
  it('passes the localized subject and a full HTML document', async () => {
    await sendEmail(options)

    const delivered = deliverMock.mock.calls[0][0]

    expect(delivered.to).toBe('applicant@example.com')
    expect(delivered.subject).toBe('Вашу заявку схвалено — «Група підтримки»')
    expect(delivered.html).toContain('<!doctype html>')
    expect(delivered.html).toContain('Група підтримки')
    expect(delivered.idempotencyKey).toBeTruthy()
  })

  it('generates a fresh idempotency key per message', async () => {
    await sendEmail(options)
    await sendEmail(options)

    const [first, second] = deliverMock.mock.calls.map(call => call[0].idempotencyKey)
    expect(first).not.toBe(second)
  })

  it('forwards replyTo', async () => {
    await sendEmail({ ...options, replyTo: 'organizer@psygroup.org' })

    expect(deliverMock.mock.calls[0][0].replyTo).toBe('organizer@psygroup.org')
  })

  it('renders the English variant for the en locale', async () => {
    await sendEmail({ ...options, locale: 'en' })

    const delivered = deliverMock.mock.calls[0][0]
    expect(delivered.subject).toContain('Your application was approved')
    expect(delivered.html).toContain('/en/groups/support-group')
  })

  it('stores entityId as null when the caller omits it', async () => {
    const { entityId: _entityId, ...withoutEntityId } = options

    await sendEmail(withoutEntityId)

    expect(prisma.emailEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ entityId: null }),
      select: { id: true },
    })
  })
})

// The detached `sendEmailFireAndForget` wrapper is gone. Nothing kept its promise alive
// once a Vercel function had answered — Nitro's Vercel runtime wires no waitUntil — so
// mail was silently dropped in production while every local run delivered it. These pin
// the replacement contract: awaited to completion, and still never throwing.
describe('sendEmail — the awaited contract', () => {
  it('has finished the delivery attempt by the time it resolves', async () => {
    let delivered = false
    deliverMock.mockImplementation(async () => {
      await new Promise(resolve => setTimeout(resolve, 20))
      delivered = true
      return { status: 'sent', attempts: 1 }
    })

    await sendEmail(options)

    expect(delivered).toBe(true)
  })

  it('never surfaces a rejection to the caller', async () => {
    prisma.emailEvent.create.mockRejectedValue(new Error('db down'))
    deliverMock.mockRejectedValue(new Error('transport down'))

    await expect(sendEmail(options)).resolves.toBeUndefined()
  })
})

describe('absoluteUrl', () => {
  it('prefixes the locale', () => {
    expect(absoluteUrl('https://psygroup.org', 'ua', '/groups/x')).toBe('https://psygroup.org/ua/groups/x')
    expect(absoluteUrl('https://psygroup.org', 'en', '/catalog')).toBe('https://psygroup.org/en/catalog')
  })

  it('maps the root to the locale landing page without a double slash', () => {
    expect(absoluteUrl('https://psygroup.org', 'ua', '/')).toBe('https://psygroup.org/ua')
  })

  it('tolerates a path without a leading slash', () => {
    expect(absoluteUrl('https://psygroup.org', 'ua', 'groups/x')).toBe('https://psygroup.org/ua/groups/x')
  })
})
