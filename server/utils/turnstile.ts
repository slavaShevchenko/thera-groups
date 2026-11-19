import { resolveEnvValue } from './config'

const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'

interface TurnstileVerifyResult {
  success: boolean
  errorCodes?: string[]
}

/**
 * Verify a Cloudflare Turnstile token server-side.
 * Returns true if the token is valid, false otherwise.
 * If TURNSTILE_SECRET_KEY is not configured, returns true (graceful degradation for dev).
 */
export async function verifyTurnstileToken(token: string): Promise<boolean> {
  const secretKey = resolveEnvValue('TURNSTILE_SECRET_KEY')

  // Graceful degradation: if not configured, allow in dev
  if (!secretKey) {
    if (process.env.NODE_ENV === 'production') {
      console.warn('[turnstile] TURNSTILE_SECRET_KEY not configured — rejecting token')
      return false
    }
    return true
  }

  if (!token) {
    return false
  }

  try {
    const response = await $fetch<TurnstileVerifyResult>(TURNSTILE_VERIFY_URL, {
      method: 'POST',
      body: {
        secret: secretKey,
        response: token,
      },
    })

    return response.success === true
  }
  catch (error) {
    console.error('[turnstile] Verification request failed:', error)
    return false
  }
}
