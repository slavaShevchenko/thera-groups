import { DEFAULT_EMAIL_FROM } from '../../utils/config'
import type { DeliverInput, EmailDeliveryResult } from './types'

/**
 * Resend delivery: configuration resolution, the dev short-circuit and the retry loop.
 *
 * Configuration is read from `process.env` rather than `useServerConfig()` on purpose —
 * the transport has no request context, `server/utils/rateLimit.ts` already reads
 * `process.env` for the same reason, and it keeps the unit tests free of a Nuxt runtime.
 */

const MAX_ATTEMPTS = 3
/** Waits between the three attempts. The 10s figure from the delivery budget is the per-attempt timeout. */
const RETRY_DELAYS_MS = [1000, 4000]
const ATTEMPT_TIMEOUT_MS = 10_000

export interface TransportOverrides {
  apiKey?: string
  from?: string
  siteUrl?: string
  isDev?: boolean
  forceSend?: boolean
  maxAttempts?: number
  delaysMs?: number[]
  timeoutMs?: number
  /** Replaces the Resend call. Test seam — production always sends through the SDK. */
  send?: (_input: DeliverInput) => Promise<{ id?: string | null }>
}

export interface EmailTransportConfig {
  apiKey: string
  from: string
  siteUrl: string
  isDev: boolean
  forceSend: boolean
  maxAttempts: number
  delaysMs: number[]
  timeoutMs: number
  send?: (_input: DeliverInput) => Promise<{ id?: string | null }>
}

export function resolveEmailConfig(overrides: TransportOverrides = {}): EmailTransportConfig {
  return {
    apiKey: overrides.apiKey ?? process.env.RESEND_API_KEY ?? '',
    from: overrides.from || process.env.EMAIL_FROM || DEFAULT_EMAIL_FROM,
    siteUrl: (overrides.siteUrl ?? process.env.SITE_URL ?? 'http://localhost:3000').replace(/\/+$/, ''),
    isDev: overrides.isDev ?? import.meta.dev === true,
    forceSend: overrides.forceSend ?? process.env.EMAIL_FORCE_SEND === 'true',
    maxAttempts: overrides.maxAttempts ?? MAX_ATTEMPTS,
    delaysMs: overrides.delaysMs ?? RETRY_DELAYS_MS,
    timeoutMs: overrides.timeoutMs ?? ATTEMPT_TIMEOUT_MS,
    send: overrides.send,
  }
}

export async function deliver(
  input: DeliverInput,
  overrides: TransportOverrides = {},
): Promise<EmailDeliveryResult> {
  const config = resolveEmailConfig(overrides)

  // A missing key is a deployment gap, not a message failure: the caller still gets a
  // row in EmailEvent explaining why nothing left the process. `from` has no equivalent
  // guard because it falls back to DEFAULT_EMAIL_FROM, exactly as the previous
  // Resend integration did.
  if (!config.apiKey) {
    return { status: 'skipped', attempts: 0, error: 'RESEND_API_KEY is not configured' }
  }

  if (config.isDev && !config.forceSend) {
    console.warn(`[email] dev preview for ${input.template} to ${input.to}`)
    return { status: 'dev_preview', attempts: 0, html: input.html }
  }

  let lastError: unknown = null

  for (let attempt = 1; attempt <= config.maxAttempts; attempt += 1) {
    try {
      const result = await withTimeout(sendOnce(input, config), config.timeoutMs)
      return { status: 'sent', attempts: attempt, providerId: result.id ?? undefined }
    }
    catch (error) {
      lastError = error
      if (attempt < config.maxAttempts) {
        await sleep(config.delaysMs[attempt - 1] ?? 0)
      }
    }
  }

  return {
    status: 'failed',
    attempts: config.maxAttempts,
    error: lastError instanceof Error ? lastError.message : 'Resend delivery failed',
  }
}

async function sendOnce(
  input: DeliverInput,
  config: EmailTransportConfig,
): Promise<{ id?: string | null }> {
  if (config.send) return config.send(input)

  // Imported lazily so the SDK is never loaded on a request that sends no mail.
  const { Resend } = await import('resend')
  const resend = new Resend(config.apiKey)

  const { data, error } = await resend.emails.send(
    {
      from: config.from,
      to: input.to,
      subject: input.subject,
      html: input.html,
      ...(input.replyTo && { replyTo: input.replyTo }),
    },
    // Stable across retries, so a resend of an already-accepted message is deduplicated
    // by Resend instead of reaching the recipient twice.
    { idempotencyKey: input.idempotencyKey },
  )

  if (error) throw new Error(error.message || 'Resend rejected the message')

  return { id: data?.id ?? null }
}

/**
 * Caps one attempt so a hung socket cannot hold a serverless function open. The losing
 * promise gets a no-op handler: without it, a rejection arriving after the timeout won
 * would surface as an unhandled rejection and take the process down.
 */
async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  promise.catch(() => {})

  let timer: ReturnType<typeof setTimeout> | undefined

  try {
    return await Promise.race([
      promise,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error(`Resend send timed out after ${ms}ms`)), ms)
      }),
    ])
  }
  finally {
    if (timer) clearTimeout(timer)
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}
