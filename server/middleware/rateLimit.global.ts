import { globalLimiter, getClientIP } from '../utils/rateLimit'

export default defineEventHandler(async (event) => {
  if (import.meta.dev) return

  const path = event.path || ''
  if (
    path.startsWith('/_nuxt')
    || path === '/health'
    || path.startsWith('/api/health')
    || path.startsWith('/__')
  ) {
    return
  }

  const ip = getClientIP(event)
  try {
    await globalLimiter.consume(ip)
  }
  catch (rejRes) {
    const retrySecs = Math.round((rejRes as { msBeforeNext: number }).msBeforeNext / 1000) || 1
    throw createError({
      statusCode: 429,
      statusMessage: 'Too many requests',
      data: { code: 'RATE_LIMITED', retryAfter: retrySecs },
    })
  }
})
