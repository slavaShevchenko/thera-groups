import { globalLimiter, useRateLimiter } from '../utils/rateLimit'

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

  // Same address resolution and the same 429 shape as the per-endpoint limiters, so there
  // is one place that decides who a request came from.
  await useRateLimiter(event, globalLimiter)
})
