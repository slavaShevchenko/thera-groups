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
 * and this deployment has a hard ceiling to respect: `DATABASE_URL` points at the Supabase
 * **session** pooler, which pins one Postgres backend per client connection instead of
 * multiplexing, and that project reports `max_connections = 60`. `server/utils/rateLimit.ts`
 * opens a second pool of five for the limiter tables, so an instance used to hold
 * 10 + 5 = 15 — four concurrent Vercel instances exhausted the database and every request
 * after that failed with P2024 → 503 `SERVICE_BUSY`, site-wide at once.
 *
 * At 2 + 5 = 7 the same 60 connections carry eight instances. Two rather than one because
 * an interactive `$transaction` checks a connection out for its whole body, so a single
 * connection would serialize every request on an instance; every query inside those
 * transactions goes through `tx`, which is what keeps the second connection free.
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
