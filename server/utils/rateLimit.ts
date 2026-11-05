import { createHash } from 'node:crypto'
import { RateLimiterPostgres } from 'rate-limiter-flexible'
import { getHeader, getRequestIP, setResponseHeader, type H3Event } from 'h3'
import pg from 'pg'
import { createDbConnectionConfig } from './dbConnection'
import { normalizeEmail } from './emailAddress'
import { logHandlerError } from './errorHandler'

let pool: pg.Pool | null = null

/**
 * Two connections, not `pg`'s default ten.
 *
 * Together with `POOL_MAX` in `server/utils/prisma.ts` this is everything one serverless
 * instance holds open, and both count against the pooler's client limit rather than against
 * Postgres' `max_connections` — see `docs/deployment.md#database-connections`. A limiter
 * query is one indexed round trip, so two in flight is already more concurrency than a
 * function that is frozen between requests generates: a burst queues on the pool for
 * milliseconds, and a store that cannot answer at all is let through by `consumeOrThrow`.
 */
const LIMITER_POOL_MAX = 2

function getPool(): pg.Pool {
  if (!pool) {
    const url = process.env.DATABASE_URL
    if (!url) {
      throw new Error('DATABASE_URL is not configured')
    }
    pool = new pg.Pool({
      ...createDbConnectionConfig(url),
      max: LIMITER_POOL_MAX,
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

/**
 * Addresses that are infrastructure rather than a visitor: RFC1918, loopback, link-local,
 * carrier-grade NAT, "this network", IPv6 unique-local and link-local, and the IPv4-mapped
 * form of the reserved v4 ranges. An entry like this in `x-forwarded-for` is a hop, never
 * the party being limited.
 */
const RESERVED_ADDRESS = /^(?:10\.|127\.|0\.|169\.254\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.|100\.(?:6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.|::1$|f[cd]|fe[89ab]|::ffff:(?:10\.|127\.|0\.|169\.254\.|192\.168\.|172\.))/

function isReservedAddress(candidate: string): boolean {
  // IPv6 arrives in any case and may carry a zone id (`fe80::1%eth0`).
  const address = candidate.toLowerCase().split('%')[0] ?? ''
  return RESERVED_ADDRESS.test(address)
}

/**
 * How many trusted proxy entries sit to the **right** of the real client address.
 *
 * `0` — the default, and what Vercel produces: it appends the connecting client to
 * whatever the client sent, so the right-most entry is the client and anything left of it
 * is attacker-controlled. A deployment behind its own nginx or load balancer sets this to
 * the number of hops it adds, and the client is then read positionally instead of
 * heuristically.
 */
function configuredProxyHops(): number | null {
  const raw = process.env.TRUSTED_PROXY_HOPS
  if (raw === undefined || raw.trim() === '') return null

  const hops = Number.parseInt(raw, 10)
  return Number.isInteger(hops) && hops >= 0 ? hops : null
}

/**
 * The address a request is limited under.
 *
 * `x-real-ip` is deliberately never read. It is a plain request header: whatever Vercel
 * puts there, a client can put there first, and one `curl -H 'X-Real-IP: 1.2.3.4'` per
 * attempt was enough to keep the login and register limiters from ever firing. See
 * `docs/security.md`.
 */
export function getClientIP(event: Parameters<typeof getHeader>[0]): string {
  const forwarded = getHeader(event as Parameters<typeof getHeader>[0], 'x-forwarded-for')
  const hops = forwarded
    ? forwarded.split(',').map(part => part.trim()).filter(Boolean)
    : []

  if (hops.length > 0) {
    const configured = configuredProxyHops()

    if (configured !== null) {
      // Clamped: a hop count larger than the header is a misconfiguration, and falling
      // back to the left-most entry is still a real address rather than a shared bucket.
      return hops[Math.max(0, hops.length - 1 - configured)] as string
    }

    // Right to left, skipping infrastructure. The right-most entry Vercel appended is the
    // client; anything it had to step over to find a public address was a hop.
    for (let i = hops.length - 1; i >= 0; i--) {
      if (!isReservedAddress(hops[i] as string)) return hops[i] as string
    }

    return hops[hops.length - 1] as string
  }

  try {
    const ip = getRequestIP(event as Parameters<typeof getRequestIP>[0])
    return ip ?? 'unknown'
  }
  catch {
    return 'unknown'
  }
}

/**
 * A second bucket keyed by the account rather than by where the attempt came from.
 *
 * Hashed, because `rate_limits` is a plain table anybody with database access can read
 * and the whole point of the key is an address somebody typed into a login form.
 */
export function emailRateLimitKey(email: string): string {
  const digest = createHash('sha256').update(normalizeEmail(email)).digest('hex')
  return `em:${digest.slice(0, 32)}`
}

function isRateLimitRejection(err: unknown): err is { msBeforeNext: number } {
  if (!err || typeof err !== 'object' || !('msBeforeNext' in err)) return false

  const msBeforeNext = (err as { msBeforeNext: unknown }).msBeforeNext

  // `typeof NaN === 'number'`, so a plain type check would let a malformed result through
  // and turn it into `Math.round(NaN / 1000) || 1` — a 429 with `Retry-After: 1` on every
  // request the site receives. Only a real, non-negative wait is a real rejection.
  //
  // Non-negative also excludes the `-1` the Postgres driver stores for "this key never
  // expires", which only a `duration: 0` limiter can produce. Every limiter here uses a
  // positive duration, so a `-1` reaching this check would mean the row was unreadable
  // rather than that a visitor is blocked forever — an unlimited limiter needs a third case.
  return typeof msBeforeNext === 'number' && Number.isFinite(msBeforeNext) && msBeforeNext >= 0
}

/**
 * Consumes one point, turning an exhausted bucket into the 429 the client understands.
 * A store failure is logged and let through: rate limiting must not be able to take the
 * site down when `rate_limits` is unreachable.
 */
async function consumeOrThrow(
  limiter: ReturnType<typeof createStore>,
  key: string,
  event?: H3Event,
) {
  try {
    await limiter.consume(key)
  }
  catch (err) {
    if (isRateLimitRejection(err)) {
      const retrySecs = Math.max(1, Math.ceil(err.msBeforeNext / 1000))

      // The body carries `retryAfter` next to the trusted `RATE_LIMITED` code; the header
      // is what a consumer that is not ours reads (RFC 6585). Set before throwing, because
      // the error handlers downstream rebuild the error and only the response survives
      // that. h3 types `Retry-After` as a number of seconds, which is what the wire carries.
      if (event) setResponseHeader(event, 'Retry-After', retrySecs)

      throw createError({
        statusCode: 429,
        statusMessage: 'Too many requests',
        data: { code: 'RATE_LIMITED', retryAfter: retrySecs },
      })
    }

    logHandlerError(err, { source: 'rateLimit', event })
  }
}

/**
 * Limits one request by client address.
 *
 * Called before the body is read, so an oversized or malformed payload still costs the
 * sender a point.
 */
export async function useRateLimiter(
  event: Parameters<typeof getClientIP>[0],
  limiter: ReturnType<typeof createStore>,
) {
  if (import.meta.dev) return

  await consumeOrThrow(limiter, `ip:${getClientIP(event)}`, event)
}

/**
 * Limits one request by the account it acts on, in addition to the address bucket.
 *
 * The two answer different abuses and neither covers the other: the address bucket stops
 * one host spraying attempts, this one stops a distributed attacker from grinding a single
 * login — and it also means a household or an office NAT-ing several organizers behind one
 * address does not share a single login budget. Called after validation because the
 * address is only known once the body has been parsed.
 */
export async function useEmailRateLimiter(
  limiter: ReturnType<typeof createStore>,
  email: string,
  event?: H3Event,
) {
  if (import.meta.dev) return

  await consumeOrThrow(limiter, emailRateLimitKey(email), event)
}
