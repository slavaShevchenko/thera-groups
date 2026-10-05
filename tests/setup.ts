import { vi } from 'vitest'
import {
  createError as h3CreateError,
  defineEventHandler,
  readBody,
  readRawBody,
  getQuery,
  getHeader,
  getRouterParam,
} from 'h3'

// Unit and shared suites must never reach a real mail provider, even when the
// developer's shell exports credentials. server/services/email/transport.ts reads
// these directly, so clearing them here makes every unmocked send degrade to `skipped`.
process.env.RESEND_API_KEY = ''
process.env.EMAIL_FROM = ''
process.env.RESEND_WEBHOOK_SECRET = ''

if (typeof globalThis.createError !== 'function') {
  (globalThis as Record<string, unknown>).createError = h3CreateError
}

if (typeof globalThis.defineEventHandler !== 'function') {
  (globalThis as Record<string, unknown>).defineEventHandler = defineEventHandler
}

if (typeof globalThis.readBody !== 'function') {
  (globalThis as Record<string, unknown>).readBody = readBody
}

if (typeof globalThis.readRawBody !== 'function') {
  (globalThis as Record<string, unknown>).readRawBody = readRawBody
}

if (typeof globalThis.getQuery !== 'function') {
  (globalThis as Record<string, unknown>).getQuery = getQuery
}

if (typeof globalThis.getHeader !== 'function') {
  (globalThis as Record<string, unknown>).getHeader = getHeader
}

if (typeof globalThis.getRouterParam !== 'function') {
  (globalThis as Record<string, unknown>).getRouterParam = getRouterParam
}

const mockPrisma = {
  group: {
    findUnique: vi.fn(),
    findUniqueOrThrow: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  },
  groupTag: {
    findMany: vi.fn(),
  },
  groupCoOrganizer: {
    deleteMany: vi.fn(),
    createMany: vi.fn(),
    findFirst: vi.fn(),
    count: vi.fn(),
  },
  applicationQuestion: {
    deleteMany: vi.fn(),
    create: vi.fn(),
    createMany: vi.fn(),
  },
  application: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    count: vi.fn(),
  },
  organizerProfile: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    count: vi.fn(),
  },
  user: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    upsert: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  },
  notification: {
    create: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
  favorite: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
  },
  emailEvent: {
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
  },
  $transaction: vi.fn(async (fn: (_tx: unknown) => Promise<unknown>) => {
    return fn(mockPrisma)
  }),
}

;(globalThis as Record<string, unknown>).prisma = mockPrisma

vi.mock('~~/server/utils/prisma', () => ({ prisma: mockPrisma }))
