import { vi } from 'vitest'

if (typeof globalThis.createError !== 'function') {
  (globalThis as Record<string, unknown>).createError = (opts: { statusCode: number, statusMessage: string }) => {
    const error = new Error(opts.statusMessage) as Error & { statusCode: number, statusMessage: string }
    error.statusCode = opts.statusCode
    error.statusMessage = opts.statusMessage
    return error
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
    update: vi.fn(),
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
  $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
    return fn(mockPrisma)
  }),
}

;(globalThis as Record<string, unknown>).prisma = mockPrisma

vi.mock('~~/server/utils/prisma', () => ({ prisma: mockPrisma }))
