import type { H3Event } from 'h3'
import { Webhook } from 'standardwebhooks'
import { applyProviderEvent } from '../../services/email/tracking'
import { mapPrismaError } from '../../utils/errorHandler'

/**
 * Resend delivery webhooks: moves an `EmailEvent` from SENT to DELIVERED / BOUNCED /
 * COMPLAINED using the provider id stored at send time.
 *
 * Unauthenticated by design — the provider cannot hold a session — so the Standard
 * Webhooks signature is the entire authorization story. It is deliberately not covered by
 * `requireAuth`, and it is not linked from any page, sitemap or robots entry.
 */

const EVENT_STATUS: Record<string, 'DELIVERED' | 'BOUNCED' | 'COMPLAINED'> = {
  'email.delivered': 'DELIVERED',
  'email.bounced': 'BOUNCED',
  'email.complained': 'COMPLAINED',
}

interface ResendWebhookEvent {
  type?: string
  data?: { id?: string }
}

export default defineEventHandler(async (event) => {
  // Verified against the raw bytes: any re-serialization would invalidate the signature.
  const payload = await readRawBody(event)

  if (!payload) {
    return { success: true, ignored: 'empty payload' }
  }

  const secret = process.env.RESEND_WEBHOOK_SECRET

  if (!secret) {
    if (!import.meta.dev) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Webhook secret is not configured',
        data: { code: 'UNAUTHORIZED' },
      })
    }
    console.warn('[email] RESEND_WEBHOOK_SECRET is not set — accepting the webhook unverified in dev')
  }
  else if (!hasValidSignature(payload, secret, event)) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Invalid webhook signature',
      data: { code: 'UNAUTHORIZED' },
    })
  }

  let body: ResendWebhookEvent

  try {
    body = JSON.parse(payload) as ResendWebhookEvent
  }
  catch {
    // Reachable only on the unverified dev path — `Webhook.verify` already parses the
    // payload, so a signed request with a malformed body is rejected as a bad signature.
    throw createError({
      statusCode: 400,
      statusMessage: 'Malformed webhook payload',
      data: { code: 'VALIDATION_FAILED' },
    })
  }

  const status = body.type ? EVENT_STATUS[body.type] : undefined
  const providerId = body.data?.id

  // Unknown and informational events are acknowledged: a 4xx would make Resend retry a
  // payload this endpoint can never handle.
  if (!status || !providerId) {
    return { success: true, ignored: body.type ?? 'unknown' }
  }

  try {
    const matched = await applyProviderEvent(providerId, status)
    return { success: true, matched }
  }
  catch (error) {
    // A database failure is worth a provider retry, so it must surface as a 5xx.
    throw mapPrismaError(error, 'webhooks.resend')
  }
})

/**
 * Resend sends `svix-*` headers; `standardwebhooks@1` only reads the unbranded
 * `webhook-*` names, so the prefix is translated here.
 */
function hasValidSignature(payload: string, secret: string, event: H3Event): boolean {
  const headers = {
    'webhook-id': getHeader(event, 'svix-id') ?? '',
    'webhook-timestamp': getHeader(event, 'svix-timestamp') ?? '',
    'webhook-signature': getHeader(event, 'svix-signature') ?? '',
  }

  if (!headers['webhook-id'] || !headers['webhook-timestamp'] || !headers['webhook-signature']) {
    return false
  }

  try {
    new Webhook(secret).verify(payload, headers)
    return true
  }
  catch {
    return false
  }
}
