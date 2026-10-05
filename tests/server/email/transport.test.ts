import { describe, it, expect, vi, beforeEach } from 'vitest'
import { deliver, resolveEmailConfig } from '~~/server/services/email/transport'
import type { DeliverInput } from '~~/server/services/email/types'

const { resendSend } = vi.hoisted(() => ({ resendSend: vi.fn() }))

vi.mock('resend', () => ({
  Resend: class {
    emails = { send: resendSend }
  },
}))

const input: DeliverInput = {
  to: 'applicant@example.com',
  template: 'application_approved',
  subject: 'Вашу заявку схвалено',
  html: '<p>Body</p>',
  idempotencyKey: 'idem-1',
}

// Every case passes overrides explicitly: `resolveEmailConfig` falls back to process.env,
// which tests/setup.ts clears so no suite can reach the real provider.
const credentials = {
  apiKey: 're_test_key',
  from: 'noreply@psygroup.org',
  isDev: false,
  delaysMs: [0, 0],
}

describe('email transport — configuration', () => {
  it('defaults to no API key, three attempts and a 10s per-attempt timeout', () => {
    const config = resolveEmailConfig()

    expect(config.apiKey).toBe('')
    // EMAIL_FROM is cleared by tests/setup.ts, so the shared fallback applies.
    expect(config.from).toBe('noreply@psygroup.org')
    expect(config.maxAttempts).toBe(3)
    expect(config.timeoutMs).toBe(10_000)
    expect(config.forceSend).toBe(false)
  })

  it('prefers an explicit EMAIL_FROM over the fallback', () => {
    process.env.EMAIL_FROM = 'groups@psygroup.org'
    expect(resolveEmailConfig().from).toBe('groups@psygroup.org')
    process.env.EMAIL_FROM = ''
  })

  it('strips a trailing slash from the site URL', () => {
    expect(resolveEmailConfig({ siteUrl: 'https://psygroup.org/' }).siteUrl).toBe('https://psygroup.org')
  })

  it('reads EMAIL_FORCE_SEND from the environment', () => {
    process.env.EMAIL_FORCE_SEND = 'true'
    expect(resolveEmailConfig().forceSend).toBe(true)
    process.env.EMAIL_FORCE_SEND = ''
  })
})

describe('email transport — skipped without credentials', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('skips and makes no network call when RESEND_API_KEY is absent', async () => {
    const send = vi.fn()

    const result = await deliver(input, { ...credentials, apiKey: '', send })

    expect(result.status).toBe('skipped')
    expect(result.attempts).toBe(0)
    expect(result.error).toContain('RESEND_API_KEY')
    expect(send).not.toHaveBeenCalled()
    expect(resendSend).not.toHaveBeenCalled()
  })
})

describe('email transport — dev preview', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('stores the HTML instead of sending in dev', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const send = vi.fn()

    const result = await deliver(input, { ...credentials, isDev: true, send })

    expect(result.status).toBe('dev_preview')
    expect(result.html).toBe('<p>Body</p>')
    expect(result.attempts).toBe(0)
    expect(send).not.toHaveBeenCalled()
    expect(warn).toHaveBeenCalledWith(
      '[email] dev preview for application_approved to applicant@example.com',
    )

    warn.mockRestore()
  })

  it('sends for real when EMAIL_FORCE_SEND is set', async () => {
    const send = vi.fn().mockResolvedValue({ id: 'msg_1' })

    const result = await deliver(input, { ...credentials, isDev: true, forceSend: true, send })

    expect(result.status).toBe('sent')
    expect(send).toHaveBeenCalledOnce()
  })
})

describe('email transport — retries', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('sends on the first attempt', async () => {
    const send = vi.fn().mockResolvedValue({ id: 'msg_1' })

    const result = await deliver(input, { ...credentials, send })

    expect(result).toMatchObject({ status: 'sent', attempts: 1, providerId: 'msg_1' })
  })

  it('recovers when the second attempt succeeds', async () => {
    const send = vi.fn()
      .mockRejectedValueOnce(new Error('socket hang up'))
      .mockResolvedValueOnce({ id: 'msg_2' })

    const result = await deliver(input, { ...credentials, send })

    expect(result.status).toBe('sent')
    expect(result.attempts).toBe(2)
    expect(result.providerId).toBe('msg_2')
    expect(send).toHaveBeenCalledTimes(2)
  })

  it('waits between attempts using the configured backoff', async () => {
    const calls: number[] = []
    const send = vi.fn()
      .mockImplementationOnce(async () => {
        calls.push(Date.now())
        throw new Error('first')
      })
      .mockImplementationOnce(async () => {
        calls.push(Date.now())
        return { id: 'msg_3' }
      })

    await deliver(input, { ...credentials, delaysMs: [40], send })

    expect(calls[1]! - calls[0]!).toBeGreaterThanOrEqual(35)
  })

  it('gives up after three attempts and reports the last error', async () => {
    const send = vi.fn().mockRejectedValue(new Error('Resend is down'))

    const result = await deliver(input, { ...credentials, send })

    expect(result.status).toBe('failed')
    expect(result.attempts).toBe(3)
    expect(result.error).toBe('Resend is down')
    expect(result.providerId).toBeUndefined()
    expect(send).toHaveBeenCalledTimes(3)
  })

  it('reuses the idempotency key across retries so Resend deduplicates', async () => {
    const seen: string[] = []
    const send = vi.fn().mockImplementation(async (payload: DeliverInput) => {
      seen.push(payload.idempotencyKey)
      if (seen.length < 2) throw new Error('retry')
      return { id: 'msg_4' }
    })

    await deliver(input, { ...credentials, send })

    expect(seen).toEqual(['idem-1', 'idem-1'])
  })

  it('fails instead of hanging when an attempt exceeds the timeout', async () => {
    const send = vi.fn().mockImplementation(() => new Promise(() => {}))

    const result = await deliver(input, { ...credentials, timeoutMs: 5, delaysMs: [0, 0], send })

    expect(result.status).toBe('failed')
    expect(result.attempts).toBe(3)
    expect(result.error).toContain('timed out')
  })
})

describe('email transport — Resend SDK', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('sends through the SDK and returns the provider id', async () => {
    resendSend.mockResolvedValue({ data: { id: 're_msg_1' }, error: null })

    const result = await deliver(input, credentials)

    expect(result).toMatchObject({ status: 'sent', providerId: 're_msg_1', attempts: 1 })
    expect(resendSend).toHaveBeenCalledWith(
      {
        from: 'noreply@psygroup.org',
        to: 'applicant@example.com',
        subject: 'Вашу заявку схвалено',
        html: '<p>Body</p>',
      },
      { idempotencyKey: 'idem-1' },
    )
  })

  it('passes replyTo only when it is set', async () => {
    resendSend.mockResolvedValue({ data: { id: 're_msg_2' }, error: null })

    await deliver({ ...input, replyTo: 'organizer@psygroup.org' }, credentials)

    expect(resendSend.mock.calls[0]![0]).toMatchObject({ replyTo: 'organizer@psygroup.org' })
  })

  it('treats an API-level error response as a failure', async () => {
    resendSend.mockResolvedValue({ data: null, error: { message: 'Missing from field' } })

    const result = await deliver(input, credentials)

    expect(result.status).toBe('failed')
    expect(result.error).toBe('Missing from field')
    expect(resendSend).toHaveBeenCalledTimes(3)
  })

  it('tolerates a success response without an id', async () => {
    resendSend.mockResolvedValue({ data: {}, error: null })

    const result = await deliver(input, credentials)

    expect(result.status).toBe('sent')
    expect(result.providerId).toBeUndefined()
  })
})
