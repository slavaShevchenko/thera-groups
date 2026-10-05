import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('~~/server/utils/prisma', () => ({ prisma: globalThis.prisma }))

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- globalThis.prisma is set in test setup
const prisma = globalThis.prisma as any

// eslint-disable-next-line import/first -- import must follow vi.mock()
import * as tracking from '~~/server/services/email/tracking'

const record = {
  recipient: 'applicant@example.com',
  template: 'application_approved',
  type: 'APPLICATION_APPROVED',
  locale: 'ua',
  entityId: 'group-slug',
}

describe('email tracking — lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('queues a row as PENDING before the first delivery attempt', async () => {
    prisma.emailEvent.create.mockResolvedValue({ id: 'evt_1' })

    const id = await tracking.createQueued(record)

    expect(id).toBe('evt_1')
    expect(prisma.emailEvent.create).toHaveBeenCalledWith({
      data: { ...record, status: 'PENDING' },
      select: { id: true },
    })
  })

  it('moves queued → sent with the provider id and a timestamp', async () => {
    await tracking.markSent('evt_1', 're_msg_1')

    const call = prisma.emailEvent.update.mock.calls[0][0]
    expect(call.where).toEqual({ id: 'evt_1' })
    expect(call.data.status).toBe('SENT')
    expect(call.data.providerId).toBe('re_msg_1')
    expect(call.data.error).toBeNull()
    expect(call.data.sentAt).toBeInstanceOf(Date)
  })

  it('moves queued → failed with a sanitized reason', async () => {
    await tracking.markFailed('evt_1', 'Resend rejected re_abcdefgh12345678')

    expect(prisma.emailEvent.update).toHaveBeenCalledWith({
      where: { id: 'evt_1' },
      data: { status: 'FAILED', error: 'Resend rejected [redacted-api-key]' },
    })
  })

  it('moves queued → skipped when delivery is not configured', async () => {
    await tracking.markSkipped('evt_1', 'RESEND_API_KEY is not configured')

    expect(prisma.emailEvent.update).toHaveBeenCalledWith({
      where: { id: 'evt_1' },
      data: { status: 'SKIPPED', error: 'RESEND_API_KEY is not configured' },
    })
  })

  it('stores the rendered HTML for a dev preview', async () => {
    await tracking.markDevPreview('evt_1', '<html>preview</html>')

    expect(prisma.emailEvent.update).toHaveBeenCalledWith({
      where: { id: 'evt_1' },
      data: { status: 'DEV_PREVIEW', html: '<html>preview</html>', error: null },
    })
  })

  it('records a message that never reached the transport as FAILED', async () => {
    await tracking.recordFailure(record, 'Unknown email template: nope')

    expect(prisma.emailEvent.create).toHaveBeenCalledWith({
      data: { ...record, status: 'FAILED', error: 'Unknown email template: nope' },
    })
  })
})

describe('email tracking — provider webhooks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('updates by providerId and reports a match', async () => {
    prisma.emailEvent.updateMany.mockResolvedValue({ count: 1 })

    const matched = await tracking.applyProviderEvent('re_msg_1', 'DELIVERED')

    expect(matched).toBe(true)
    expect(prisma.emailEvent.updateMany).toHaveBeenCalledWith({
      where: { providerId: 're_msg_1' },
      data: { status: 'DELIVERED' },
    })
  })

  it('returns false for an unknown providerId instead of throwing', async () => {
    prisma.emailEvent.updateMany.mockResolvedValue({ count: 0 })

    await expect(tracking.applyProviderEvent('nope', 'BOUNCED')).resolves.toBe(false)
  })
})

describe('sanitizeEmailError', () => {
  it('redacts Resend API keys and webhook secrets', () => {
    expect(tracking.sanitizeEmailError('key re_1234567890abc failed'))
      .toBe('key [redacted-api-key] failed')
    expect(tracking.sanitizeEmailError('secret whsec_abcdef123456 leaked'))
      .toBe('secret [redacted-webhook-secret] leaked')
  })

  it('redacts authorization material', () => {
    expect(tracking.sanitizeEmailError('Authorization: Bearer abc.def.ghi'))
      .toBe('Authorization: [redacted]')
  })

  it('accepts an Error, a string or an unknown value', () => {
    expect(tracking.sanitizeEmailError(new Error('boom'))).toBe('boom')
    expect(tracking.sanitizeEmailError('plain')).toBe('plain')
    expect(tracking.sanitizeEmailError(undefined)).toBe('Unknown error')
    expect(tracking.sanitizeEmailError({ code: 500 })).toBe('Unknown error')
  })

  it('collapses whitespace and truncates', () => {
    const long = `line1\nline2 ${'x'.repeat(900)}`
    const result = tracking.sanitizeEmailError(long)

    expect(result).not.toContain('\n')
    expect(result.length).toBeLessThanOrEqual(500)
  })

  it('never returns an empty string', () => {
    expect(tracking.sanitizeEmailError('   \n  ')).toBe('Unknown error')
  })
})
