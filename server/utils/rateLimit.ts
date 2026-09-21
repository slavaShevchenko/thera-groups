import { RateLimiterPostgres } from 'rate-limiter-flexible'
import { getHeader, getRequestIP } from 'h3'
import pg from 'pg'

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5,
})

function createStore(keyPrefix: string, points: number, duration: number) {
  return new RateLimiterPostgres({
    storeClient: pool,
    keyPrefix,
    points,
    duration,
    tableName: 'rate_limits',
  })
}

export const authLimiter = createStore('auth', 5, 60 * 15)
export const registerLimiter = createStore('register', 3, 60 * 60)
export const applicationLimiter = createStore('app', 10, 60 * 15)
export const globalLimiter = createStore('global', 100, 60)
export const uploadLimiter = createStore('upload', 10, 60 * 60)

function isPrivateIP(ip: string): boolean {
  return /^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|127\.|::1|fe80:)/.test(ip)
}

export function getClientIP(event: Parameters<typeof getHeader>[0]): string {
  const realIP = getHeader(event as Parameters<typeof getHeader>[0], 'x-real-ip')
  if (realIP) return realIP

  const xff = getHeader(event as Parameters<typeof getHeader>[0], 'x-forwarded-for')
  if (xff) {
    const ips = xff.split(',').map(ip => ip.trim())
    for (let i = ips.length - 1; i >= 0; i--) {
      if (!isPrivateIP(ips[i])) return ips[i]
    }
    return ips[ips.length - 1]
  }

  try {
    return getRequestIP(event as Parameters<typeof getRequestIP>[0]) || 'unknown'
  }
  catch {
    return 'unknown'
  }
}

export async function useRateLimiter(
  event: Parameters<typeof getClientIP>[0],
  limiter: RateLimiterPostgres,
) {
  const ip = getClientIP(event)
  try {
    await limiter.consume(ip)
  }
  catch (rejRes) {
    const retrySecs = Math.round((rejRes as { msBeforeNext: number }).msBeforeNext / 1000) || 1
    throw createError({
      statusCode: 429,
      statusMessage: 'Too many requests',
      data: { code: 'RATE_LIMITED', retryAfter: retrySecs },
    })
  }
}
