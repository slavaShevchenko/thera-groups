import { prisma } from '../../utils/prisma'

/**
 * `EmailEvent` is the single audit trail for outbound mail: one row per message, moved
 * through PENDING (queued) → SENT → DELIVERED/BOUNCED/COMPLAINED, or short-circuited to
 * SKIPPED / DEV_PREVIEW / FAILED.
 *
 * Every function here throws on a database failure; `index.ts` owns the decision not to
 * let that reach a caller.
 */

export interface QueuedEmailRecord {
  recipient: string
  template: string
  type: string
  locale: string
  entityId: string | null
}

export async function createQueued(record: QueuedEmailRecord): Promise<string> {
  const created = await prisma.emailEvent.create({
    data: {
      recipient: record.recipient,
      template: record.template,
      type: record.type,
      locale: record.locale,
      entityId: record.entityId,
      status: 'PENDING',
    },
    select: { id: true },
  })

  return created.id
}

/**
 * Records a message that never reached the transport — an unknown template, a renderer
 * crash. Written straight to FAILED because there was never a delivery attempt to retry.
 */
export async function recordFailure(record: QueuedEmailRecord, error: string): Promise<void> {
  await prisma.emailEvent.create({
    data: {
      recipient: record.recipient,
      template: record.template,
      type: record.type,
      locale: record.locale,
      entityId: record.entityId,
      status: 'FAILED',
      error: sanitizeEmailError(error),
    },
  })
}

export async function markSent(id: string, providerId: string | null): Promise<void> {
  await prisma.emailEvent.update({
    where: { id },
    data: { status: 'SENT', sentAt: new Date(), providerId, error: null },
  })
}

export async function markFailed(id: string, error: string): Promise<void> {
  await prisma.emailEvent.update({
    where: { id },
    data: { status: 'FAILED', error: sanitizeEmailError(error) },
  })
}

export async function markSkipped(id: string, reason: string): Promise<void> {
  await prisma.emailEvent.update({
    where: { id },
    data: { status: 'SKIPPED', error: sanitizeEmailError(reason) },
  })
}

/**
 * Stores the rendered message. Dev has no provider inbox to inspect, so the preview has
 * to live in the row; production rows never take this path.
 */
export async function markDevPreview(id: string, html: string): Promise<void> {
  await prisma.emailEvent.update({
    where: { id },
    data: { status: 'DEV_PREVIEW', html, error: null },
  })
}

/**
 * Applies a Resend delivery webhook. `updateMany` rather than `update` so an unknown or
 * already-deleted providerId is a no-op returning `false` instead of a thrown P2025 —
 * Resend retries on a non-2xx, and a 500 for a stale event would retry forever.
 */
export async function applyProviderEvent(
  providerId: string,
  status: 'DELIVERED' | 'BOUNCED' | 'COMPLAINED',
): Promise<boolean> {
  const result = await prisma.emailEvent.updateMany({
    where: { providerId },
    data: { status },
  })

  return result.count > 0
}

const MAX_ERROR_LENGTH = 500

/**
 * Failure text is persisted and can surface in an admin view, so anything that looks like
 * a credential is removed before it is stored. Resend errors can echo request headers.
 */
export function sanitizeEmailError(error: unknown): string {
  const message = typeof error === 'string'
    ? error
    : (error instanceof Error ? error.message : 'Unknown error')

  // Whitespace is collapsed first so the authorization pattern can redact to the end of
  // the message: a token may be followed by more text on the same logical line.
  return message
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\bre_[A-Za-z0-9_-]{8,}/g, '[redacted-api-key]')
    .replace(/\bwhsec_[A-Za-z0-9_-]{8,}/g, '[redacted-webhook-secret]')
    .replace(/\b(Authorization|Bearer)\b[:=]?.*/gi, '$1: [redacted]')
    .slice(0, MAX_ERROR_LENGTH)
    || 'Unknown error'
}
