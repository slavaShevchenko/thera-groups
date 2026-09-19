import { vi } from 'vitest'

// Provide Nuxt/Nitro auto-imports that are not available in Vitest environment
if (typeof globalThis.createError !== 'function') {
  (globalThis as Record<string, unknown>).createError = (opts: { statusCode: number, statusMessage: string }) => {
    const error = new Error(opts.statusMessage) as Error & { statusCode: number, statusMessage: string }
    error.statusCode = opts.statusCode
    error.statusMessage = opts.statusMessage
    return error
  }
}

// Mock prisma — used both as module export and as Nitro auto-import (global)
const mockPrisma = {
  group: {
    findUnique: vi.fn(),
    findUniqueOrThrow: vi.fn(),
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
  },
  application: {
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  organizerProfile: {
    findUnique: vi.fn(),
  },
  user: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
  },
  notification: {
    create: vi.fn(),
  },
  emailEvent: {
    create: vi.fn(),
    update: vi.fn(),
  },
}

// Provide as global (Nitro auto-import)
;(globalThis as Record<string, unknown>).prisma = mockPrisma

// Provide as module (explicit import)
vi.mock('~~/server/utils/prisma', () => ({ prisma: mockPrisma }))
