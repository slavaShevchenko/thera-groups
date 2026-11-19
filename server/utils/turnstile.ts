import { resolveServerEnv } from './config'
import { apiError } from './apiError'
import { ErrorCodes } from './errorCodes'

const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'

/**
 * Cloudflare names its rejection reasons `error-codes`. Reading them as `errorCodes` left
 * the field permanently `undefined`, so a rejection reached the operator as a bare 400
 * with no way to tell an expired token from a wrong secret — which is exactly the failure
 * that goes unnoticed until real sign-ups stop landing.
 */
interface TurnstileVerifyResult {
  'success': boolean
  'error-codes'?: string[]
}

type VerifyFetch = (
  _url: string,
  _options: { method: 'POST', body: Record<string, string> },
) => Promise<TurnstileVerifyResult>

/**
 * Seams over the two Nitro globals this module runs on. Both are auto-imported rather than
 * imported by name, so neither can be replaced from a test — these parameters are what
 * makes the branches reachable without a Nuxt app or a network. Production callers pass
 * nothing. Same shape as `resolveServerEnv(runtimeConfig)`.
 */
export interface TurnstileDeps {
  secretKey?: string
  fetcher?: VerifyFetch
}

/**
 * Verify a Cloudflare Turnstile token server-side.
 * Returns true if the token is valid, false otherwise.
 * If TURNSTILE_SECRET_KEY is not configured, returns true (graceful degradation for dev).
 */
export async function verifyTurnstileToken(
  token: unknown,
  deps: TurnstileDeps = {},
): Promise<boolean> {
  const secretKey = deps.secretKey ?? resolveServerEnv().turnstileSecretKey
  const verifyFetch = deps.fetcher
    ?? ((url: string, options: Parameters<VerifyFetch>[1]) =>
      $fetch<TurnstileVerifyResult>(url, options))

  // Graceful degradation: if not configured, allow in dev. Production never reaches this
  // branch with an empty key — `REQUIRED_IN_PRODUCTION` in server/utils/config.ts refuses
  // to boot the process without one.
  if (!secretKey) {
    if (process.env.NODE_ENV === 'production') {
      console.warn('[turnstile] TURNSTILE_SECRET_KEY not configured — rejecting token')
      return false
    }
    return true
  }

  // The payload is still unvalidated `readBody` output when this runs, so the token can be
  // anything a caller chose to send. Only a non-empty string is worth a round-trip.
  if (typeof token !== 'string' || token === '') {
    return false
  }

  try {
    const response = await verifyFetch(TURNSTILE_VERIFY_URL, {
      method: 'POST',
      body: {
        secret: secretKey,
        response: token,
      },
    })

    if (response.success === true) return true

    console.warn(
      `[turnstile] token rejected: ${response['error-codes']?.join(', ') || 'no reason given'}`,
    )
    return false
  }
  catch (error) {
    // `$fetch` throws on a non-2xx, and Cloudflare answers **400** for a malformed secret
    // with the reason in the body (`invalid-input-secret`). Logging only the exception
    // collapsed that into a generic "request failed", which is how a wrong secret stays
    // invisible while every registration it rejects looks like a client error.
    const failure = error as {
      message?: string
      data?: TurnstileVerifyResult
      response?: { status?: number }
    }
    const status = failure.response?.status
    const reasons = failure.data?.['error-codes']?.join(', ')

    console.error(
      `[turnstile] Verification request failed${status ? ` (HTTP ${status})` : ''}: `
      + `${reasons || failure.message || 'unknown reason'}`,
      error,
    )
    return false
  }
}

/**
 * The spam check every public form endpoint runs before it looks at the rest of the payload.
 *
 * One helper rather than a copy per handler, because the dev/prod split is a business rule
 * and AGENTS.md keeps those out of handlers. Both halves fail closed in production: an
 * invalid token is rejected, and so is a missing one — otherwise dropping the field would
 * be the easiest way past the check. Dev tolerates a missing token so a checkout with the
 * keys still commented out in `.env.example` can submit a form.
 */
export async function requireTurnstileToken(
  body: { turnstileToken?: unknown } | null,
  deps: TurnstileDeps = {},
): Promise<void> {
  if (body?.turnstileToken) {
    if (!await verifyTurnstileToken(body.turnstileToken, deps)) {
      throw apiError(400, ErrorCodes.VALIDATION_FAILED, 'Spam check failed')
    }

    return
  }

  if (process.env.NODE_ENV === 'production') {
    throw apiError(400, ErrorCodes.VALIDATION_FAILED, 'Spam check required')
  }
}
