import { RateLimiterMemory } from 'rate-limiter-flexible'
import { createError, getRequestIP } from 'h3'

const authLimiter = new RateLimiterMemory({
  points: 5,
  duration: 60 * 15,
})

const registerLimiter = new RateLimiterMemory({
  points: 3,
  duration: 60 * 60,
})

export const applicationLimiter = new RateLimiterMemory({
  points: 10,
  duration: 60 * 15,
})

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
