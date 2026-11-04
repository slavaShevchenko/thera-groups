import { vi } from 'vitest'
import {
  createError as h3CreateError,
  defineEventHandler,
  readBody,
  readRawBody,
  readMultipartFormData,
  getRequestWebStream,
  getQuery,
  getHeader,
  getRouterParam,
  getCookie,
  setCookie,
  deleteCookie,
  getRequestURL,
  getResponseHeader,
} from 'h3'

// Unit and shared suites must never reach a real mail provider, even when the
// developer's shell exports credentials. server/services/email/transport.ts reads
// these directly, so clearing them here makes every unmocked send degrade to `skipped`.
// EMAIL_FORCE_SEND is cleared too: it is the one flag that would override the dev
// short-circuit, and a developer live-testing mail leaves it set in .env.
process.env.RESEND_API_KEY = ''
process.env.EMAIL_FROM = ''
process.env.RESEND_WEBHOOK_SECRET = ''
process.env.EMAIL_FORCE_SEND = ''

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

// Nitro injects these at build time; server/utils/oauth.ts, the OAuth handlers and the
// avatar upload handler use them as bare globals, so the suites that exercise them need
// them present.
for (const [name, fn] of Object.entries({
  getCookie,
  setCookie,
  deleteCookie,
  getRequestURL,
  getResponseHeader,
  readMultipartFormData,
  getRequestWebStream,
})) {
  if (typeof (globalThis as Record<string, unknown>)[name] !== 'function') {
    (globalThis as Record<string, unknown>)[name] = fn
  }
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
    create: vi.fn(),
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
  // `groupRepository.lockById` takes the row lock that serializes seat bookkeeping. A mock
  // cannot lock, so it answers with the seat state the test queued; what the suites assert
  // is that the service asks for the lock inside the transaction, before it counts.
  $queryRaw: vi.fn(async () => []),
}

;(globalThis as Record<string, unknown>).prisma = mockPrisma

vi.mock('~~/server/utils/prisma', () => ({ prisma: mockPrisma }))
