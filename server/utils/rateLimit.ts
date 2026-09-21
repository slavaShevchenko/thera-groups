import { RateLimiterPostgres } from 'rate-limiter-flexible'
import { getHeader, getRequestIP } from 'h3'
import pg from 'pg'
import { createDbConnectionConfig } from './dbConnection'

let pool: pg.Pool | null = null

function getPool(): pg.Pool {
  if (!pool) {
    const url = process.env.DATABASE_URL
    if (!url) {
      throw new Error('DATABASE_URL is not configured')
    }
    pool = new pg.Pool({
      ...createDbConnectionConfig(url),
      max: 5,
    })
  }
  return pool
}

function createStore(keyPrefix: string, points: number, duration: number) {
  let limiter: RateLimiterPostgres | null = null
  return {
    async consume(key: string) {
      if (!limiter) {
        limiter = new RateLimiterPostgres({
          storeClient: getPool(),
          keyPrefix,
          points,
          duration,
          tableName: 'rate_limits',
        })
      }
      return limiter.consume(key)
    },
    async get(key: string) {
      if (!limiter) {
        limiter = new RateLimiterPostgres({
          storeClient: getPool(),
          keyPrefix,
          points,
          duration,
          tableName: 'rate_limits',
        })
      }
      return limiter.get(key)
    },
  }
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
    const ips = xff.split(',').map((ip: string) => ip.trim())
    for (let i = ips.length - 1; i >= 0; i--) {
      if (!isPrivateIP(ips[i] as string)) return ips[i] as string
    }
    return ips[ips.length - 1] as string
  }

  try {
    const ip = getRequestIP(event as Parameters<typeof getRequestIP>[0])
    return ip ?? 'unknown'
  }
  catch {
    return 'unknown'
  }
}

function isRateLimitRejection(err: unknown): err is { msBeforeNext: number } {
  return !!err && typeof err === 'object' && 'msBeforeNext' in err && typeof (err as { msBeforeNext: unknown }).msBeforeNext === 'number'
}

export async function useRateLimiter(
  event: Parameters<typeof getClientIP>[0],
  limiter: ReturnType<typeof createStore>,
) {
  if (import.meta.dev) return

  const ip = getClientIP(event)
  try {
    await limiter.consume(ip)
  }
  catch (err) {
    if (isRateLimitRejection(err)) {
      const retrySecs = Math.round(err.msBeforeNext / 1000) || 1
      throw createError({
        statusCode: 429,
        statusMessage: 'Too many requests',
        data: { code: 'RATE_LIMITED', retryAfter: retrySecs },
      })
    }
    console.error('[rateLimit] consume error:', err)
  }
}
