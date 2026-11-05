import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'
import { createDbConnectionConfig } from './dbConnection'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  throw new Error('DATABASE_URL is not set')
}

/**
 * Two connections per serverless instance, where `pg.Pool` would otherwise default to ten.
 *
 * Prisma's serverless guidance is one to three connections per function instance
 * (https://www.prisma.io/docs/orm/prisma-client/setup-and-configuration/databases-connections),
 * and the ceiling to respect is **the pooler's client limit, not Postgres' `max_connections`**.
 * Supavisor counts every client connection against a per-mode cap: session mode (port 5432)
 * answered the 16th client with `(EMAXCONNSESSION) max clients reached in session mode - max
 * clients are limited to pool_size: 15` while `SHOW max_connections` still reported 60 and
 * `pg_stat_activity` still had half its slots free. The failure is site-wide and immediate —
 * the driver error maps to `P2039`, which no trusted code covers, so every read becomes
 * `500 INTERNAL`.
 *
 * Production therefore runs on the **transaction** pooler (port 6543), which multiplexes
 * clients onto its own server pool and took 40 simultaneous connections in a probe. With this
 * pool and the rate limiter's (`LIMITER_POOL_MAX` in `server/utils/rateLimit.ts`) an instance
 * holds 4 client connections. That number is per *warm instance* and does not shrink between
 * requests: Vercel freezes a function once it has answered, so `pg`'s `idleTimeoutMillis`
 * timer never runs and the sockets stay open for the instance's lifetime.
 *
 * Two rather than one because an interactive `$transaction` checks a connection out for its
 * whole body, so a single connection would serialize every request on an instance; every
 * query inside those transactions goes through `tx`, which is what keeps the second free.
 */
const POOL_MAX = 2

const adapter = new PrismaPg({
  ...createDbConnectionConfig(connectionString),
  max: POOL_MAX,
})

export const prisma
  = globalForPrisma.prisma
    ?? new PrismaClient({ adapter })

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}
