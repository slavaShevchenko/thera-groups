import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createEvent } from 'h3'
import { Webhook } from 'standardwebhooks'

vi.mock('~~/server/utils/prisma', () => ({ prisma: globalThis.prisma }))

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- globalThis.prisma is set in test setup
const prisma = globalThis.prisma as any

const SECRET = `whsec_${Buffer.from('0123456789abcdef0123456789abcdef').toString('base64')}`

function sign(payload: string, timestamp = new Date()) {
  const seconds = Math.floor(timestamp.getTime() / 1000)

  return {
    'svix-id': 'msg_webhook_1',
    'svix-timestamp': String(seconds),
    'svix-signature': new Webhook(SECRET).sign('msg_webhook_1', timestamp, payload),
  }
}

function makeEvent(payload: string, headers: Record<string, string> = {}) {
  const event = createEvent(
    { url: '/api/webhooks/resend', method: 'POST', headers },
    {},
  )
  // h3's readRawBody reads this first, which is exactly the byte stream Nitro hands over.
  ;(event as unknown as { _requestBody: string })._requestBody = payload
  return event
}

async function callHandler(event: unknown) {
  const mod = await import('~~/server/api/webhooks/resend.post')
  const handler = mod.default as unknown as (_event: unknown) => Promise<unknown>
  return handler(event)
}

function signedEvent(body: unknown) {
  const payload = JSON.stringify(body)
  return makeEvent(payload, sign(payload))
}

describe('POST /api/webhooks/resend — signature verification', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.RESEND_WEBHOOK_SECRET = SECRET
    prisma.emailEvent.updateMany.mockResolvedValue({ count: 1 })
  })

  afterEach(() => {
    process.env.RESEND_WEBHOOK_SECRET = ''
  })

  it('rejects a tampered payload with 401', async () => {
    const original = JSON.stringify({ type: 'email.delivered', data: { id: 're_1' } })
    const headers = sign(original)
    const tampered = JSON.stringify({ type: 'email.delivered', data: { id: 're_2' } })

    await expect(callHandler(makeEvent(tampered, headers)))
      .rejects
      .toMatchObject({ statusCode: 401, data: { code: 'UNAUTHORIZED' } })

    expect(prisma.emailEvent.updateMany).not.toHaveBeenCalled()
  })

  it('rejects a request with no signature headers', async () => {
    const payload = JSON.stringify({ type: 'email.delivered', data: { id: 're_1' } })

    await expect(callHandler(makeEvent(payload)))
      .rejects
      .toMatchObject({ statusCode: 401 })
  })

  it('rejects a stale signature outside the tolerance window', async () => {
    const payload = JSON.stringify({ type: 'email.delivered', data: { id: 're_1' } })
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000)

    await expect(callHandler(makeEvent(payload, sign(payload, tenMinutesAgo))))
      .rejects
      .toMatchObject({ statusCode: 401 })
  })

  it('rejects everything when the secret is not configured in production', async () => {
    process.env.RESEND_WEBHOOK_SECRET = ''
    const payload = JSON.stringify({ type: 'email.delivered', data: { id: 're_1' } })

    await expect(callHandler(makeEvent(payload, sign(payload))))
      .rejects
      .toMatchObject({ statusCode: 401, data: { code: 'UNAUTHORIZED' } })
  })

  it('rejects a malformed JSON body, because verification parses it', async () => {
    // `standardwebhooks.verify` returns the parsed payload, so an unparseable body fails
    // signature verification before the handler ever reaches its own JSON.parse. Rejecting
    // is the safe outcome: nothing unverified is acted on either way.
    const payload = '{not json'

    await expect(callHandler(makeEvent(payload, sign(payload))))
      .rejects
      .toMatchObject({ statusCode: 401, data: { code: 'UNAUTHORIZED' } })
  })
})

describe('POST /api/webhooks/resend — status updates', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.RESEND_WEBHOOK_SECRET = SECRET
    prisma.emailEvent.updateMany.mockResolvedValue({ count: 1 })
  })

  afterEach(() => {
    process.env.RESEND_WEBHOOK_SECRET = ''
  })

  it.each([
    ['email.delivered', 'DELIVERED'],
    ['email.bounced', 'BOUNCED'],
    ['email.complained', 'COMPLAINED'],
  ])('maps %s to %s', async (type, status) => {
    const result = await callHandler(signedEvent({ type, data: { id: 're_msg_9' } }))

    expect(result).toEqual({ success: true, matched: true })
    expect(prisma.emailEvent.updateMany).toHaveBeenCalledWith({
      where: { providerId: 're_msg_9' },
      data: { status },
    })
  })

  it('acknowledges an event type it does not track', async () => {
    const result = await callHandler(signedEvent({ type: 'email.sent', data: { id: 're_1' } }))

    expect(result).toEqual({ success: true, ignored: 'email.sent' })
    expect(prisma.emailEvent.updateMany).not.toHaveBeenCalled()
  })

  it('acknowledges an event without a message id', async () => {
    const result = await callHandler(signedEvent({ type: 'email.delivered', data: {} }))

    expect(result).toEqual({ success: true, ignored: 'email.delivered' })
    expect(prisma.emailEvent.updateMany).not.toHaveBeenCalled()
  })

  it('acknowledges an empty body instead of failing', async () => {
    const result = await callHandler(makeEvent('', {}))

    expect(result).toEqual({ success: true, ignored: 'empty payload' })
  })

  it('reports matched=false for a providerId that is not in EmailEvent', async () => {
    prisma.emailEvent.updateMany.mockResolvedValue({ count: 0 })

    const result = await callHandler(signedEvent({ type: 'email.delivered', data: { id: 'unknown' } }))

    expect(result).toEqual({ success: true, matched: false })
  })

  it('surfaces a database outage as 503 so Resend retries', async () => {
    prisma.emailEvent.updateMany.mockRejectedValue(
      Object.assign(new Error('Can\'t reach database server'), { code: 'P1001' }),
    )

    await expect(callHandler(signedEvent({ type: 'email.delivered', data: { id: 're_1' } })))
      .rejects
      .toMatchObject({ statusCode: 503, data: { code: 'DATABASE_UNAVAILABLE' } })
  })
})
