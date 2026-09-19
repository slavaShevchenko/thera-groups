import { RateLimiterMemory } from 'rate-limiter-flexible'
import { createError, getRequestIP } from 'h3'

/** In-memory rate limiter for authentication endpoints (5 requests per 15 minutes per IP). */
const authLimiter = new RateLimiterMemory({
  points: 5,
  duration: 60 * 15,
})

/** In-memory rate limiter for registration endpoints (3 requests per hour per IP). */
const registerLimiter = new RateLimiterMemory({
  points: 3,
  duration: 60 * 60,
})

/** In-memory rate limiter for application submission endpoints (10 requests per 15 minutes per IP). */
export const applicationLimiter = new RateLimiterMemory({
  points: 10,
  duration: 60 * 15,
})

/**
 * Applies rate limiting to a request based on client IP address.
 * Selects the appropriate limiter (auth or register) and consumes a point.
 * @param event - The H3 request event (used to extract client IP)
 * @param type - The rate limit category: 'auth' or 'register'
 * @throws 429 error if the IP has exceeded the allowed request quota, with retry time in message
 */
export async function useRateLimiter(event: Parameters<typeof getRequestIP>[0], type: 'auth' | 'register' = 'auth') {
  const ip = getRequestIP(event, { xForwardedFor: true }) || 'unknown'
  const limiter = type === 'auth' ? authLimiter : registerLimiter

  try {
    await limiter.consume(ip)
  }
  catch (rejRes) {
    const retrySecs = Math.round((rejRes as { msBeforeNext: number }).msBeforeNext / 1000) || 1
    throw createError({
      statusCode: 429,
      statusMessage: `Too many requests. Try again in ${retrySecs} seconds.`,
    })
  }
}
