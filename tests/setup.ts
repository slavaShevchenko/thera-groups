import { vi } from 'vitest'
import {
  createError as h3CreateError,
  defineEventHandler,
  readBody,
  getQuery,
  getRouterParam,
} from 'h3'

if (typeof globalThis.createError !== 'function') {
  (globalThis as Record<string, unknown>).createError = h3CreateError
}

if (typeof globalThis.defineEventHandler !== 'function') {
  (globalThis as Record<string, unknown>).defineEventHandler = defineEventHandler
}

if (typeof globalThis.readBody !== 'function') {
  (globalThis as Record<string, unknown>).readBody = readBody
}

if (typeof globalThis.getQuery !== 'function') {
  (globalThis as Record<string, unknown>).getQuery = getQuery
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
    create: vi.fn(),
    update: vi.fn(),
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
    create: vi.fn(),
    update: vi.fn(),
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
  },
  $transaction: vi.fn(async (fn: (_tx: unknown) => Promise<unknown>) => {
    return fn(mockPrisma)
  }),
}

;(globalThis as Record<string, unknown>).prisma = mockPrisma

vi.mock('~~/server/utils/prisma', () => ({ prisma: mockPrisma }))
