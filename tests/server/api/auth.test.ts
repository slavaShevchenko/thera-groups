import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createEvent } from 'h3'

vi.mock('~~/server/utils/rateLimit', () => ({
  useRateLimiter: vi.fn(),
  authLimiter: {},
  registerLimiter: {},
  applicationLimiter: {},
  globalLimiter: {},
  uploadLimiter: {},
  getClientIP: vi.fn().mockReturnValue('127.0.0.1'),
}))

vi.mock('~~/server/utils/supabase', () => ({
  createServerClient: vi.fn(),
  createAdminClient: vi.fn(),
}))

vi.mock('~~/server/utils/prisma', () => ({ prisma: globalThis.prisma }))

vi.mock('~~/server/utils/slugify', () => ({
  generateUniqueSlug: vi.fn((name: string) => Promise.resolve(name.toLowerCase().replace(/\s+/g, '-'))),
}))

vi.mock('~~/server/utils/notifications', () => ({
  notifyAdminsOrganizerPendingReview: vi.fn(),
}))

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- globalThis.prisma is set in test setup
const prisma = globalThis.prisma as any

// eslint-disable-next-line import/first -- import must follow vi.mock()
import { createServerClient, createAdminClient } from '~~/server/utils/supabase'

const mockCreateServerClient = vi.mocked(createServerClient)
const mockCreateAdminClient = vi.mocked(createAdminClient)

function makePostEvent(body: unknown) {
  const event = createEvent({ url: '/api/auth/test', method: 'POST', headers: { 'content-type': 'application/json' } }, {})
  event._requestBody = JSON.stringify(body)
  return event
}

function makeGetEvent(url = '/api/auth/me') {
  return createEvent({ url, method: 'GET' }, {})
}

describe('POST /api/auth/register', () => {
  let handler: (_event: ReturnType<typeof makePostEvent>) => Promise<unknown>

  beforeEach(async () => {
    vi.clearAllMocks()

    mockCreateAdminClient.mockReturnValue({
      auth: {
        admin: {
          createUser: vi.fn().mockResolvedValue({
            data: { user: { id: 'auth-new-user' } },
            error: null,
          }),
          deleteUser: vi.fn().mockResolvedValue({}),
          listUsers: vi.fn().mockResolvedValue({ data: { users: [] } }),
        },
      },
    } as unknown as ReturnType<typeof createAdminClient>)

    const mod = await import('../../../server/api/auth/register.post')
    handler = mod.default as unknown as (_event: ReturnType<typeof makePostEvent>) => Promise<unknown>
  })

  it('registers a VISITOR with valid data', async () => {
    prisma.user.create.mockResolvedValue({
      id: 'user-1',
      email: 'visitor@test.com',
      role: 'VISITOR',
    })

    const result = await handler(makePostEvent({
      email: 'visitor@test.com',
      password: 'password123',
      role: 'VISITOR',
    }))

    expect(result).toEqual({
      success: true,
      user: expect.objectContaining({
        email: 'visitor@test.com',
        role: 'VISITOR',
      }),
    })
  })

  it('returns 400 with VALIDATION_FAILED for short password', async () => {
    try {
      await handler(makePostEvent({
        email: 'visitor@test.com',
        password: 'short',
        role: 'VISITOR',
      }))
      expect.unreachable('should have thrown')
    }
    catch (error) {
      const err = error as { statusCode: number, data?: { code?: string } }
      expect(err.statusCode).toBe(400)
      expect(err.data?.code).toBe('VALIDATION_FAILED')
    }
  })

  it('returns 400 for invalid email', async () => {
    try {
      await handler(makePostEvent({
        email: 'not-an-email',
        password: 'password123',
        role: 'VISITOR',
      }))
      expect.unreachable('should have thrown')
    }
    catch (error) {
      const err = error as { statusCode: number, data?: { code?: string } }
      expect(err.statusCode).toBe(400)
      expect(err.data?.code).toBe('VALIDATION_FAILED')
    }
  })

  it('returns 400 when ORGANIZER role missing organizerData', async () => {
    prisma.user.create.mockResolvedValue({
      id: 'user-1',
      email: 'org@test.com',
      role: 'ORGANIZER',
    })

    try {
      await handler(makePostEvent({
        email: 'org@test.com',
        password: 'password123',
        role: 'ORGANIZER',
      }))
      expect.unreachable('should have thrown')
    }
    catch (error) {
      const err = error as { statusCode: number, data?: { code?: string } }
      expect(err.statusCode).toBe(400)
      expect(err.data?.code).toBe('VALIDATION_FAILED')
    }
  })
})

describe('POST /api/auth/login', () => {
  let handler: (_event: ReturnType<typeof makePostEvent>) => Promise<unknown>

  beforeEach(async () => {
    vi.clearAllMocks()

    const mod = await import('../../../server/api/auth/login.post')
    handler = mod.default as unknown as (_event: ReturnType<typeof makePostEvent>) => Promise<unknown>
  })

  it('returns 401 with UNAUTHORIZED for invalid credentials (no detail leak)', async () => {
    mockCreateServerClient.mockReturnValue({
      auth: {
        signInWithPassword: vi.fn().mockResolvedValue({
          data: {},
          error: { message: 'Invalid login credentials' },
        }),
        getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
        signOut: vi.fn(),
      },
    } as unknown as ReturnType<typeof createServerClient>)

    try {
      await handler(makePostEvent({
        email: 'user@test.com',
        password: 'wrongpassword',
      }))
      expect.unreachable('should have thrown')
    }
    catch (error) {
      const err = error as { statusCode: number, statusMessage: string, data?: { code?: string } }
      expect(err.statusCode).toBe(401)
      expect(err.data?.code).toBe('UNAUTHORIZED')
      expect(err.statusMessage).not.toContain('user@test.com')
      expect(err.statusMessage).not.toContain('stack')
    }
  })

  it('returns 400 with VALIDATION_FAILED for missing fields', async () => {
    try {
      await handler(makePostEvent({
        email: 'user@test.com',
      }))
      expect.unreachable('should have thrown')
    }
    catch (error) {
      const err = error as { statusCode: number, data?: { code?: string } }
      expect(err.statusCode).toBe(400)
      expect(err.data?.code).toBe('VALIDATION_FAILED')
    }
  })

  it('returns 403 FORBIDDEN for disabled account', async () => {
    mockCreateServerClient.mockReturnValue({
      auth: {
        signInWithPassword: vi.fn().mockResolvedValue({
          data: { user: { id: 'auth-1' } },
          error: null,
        }),
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'auth-1' } },
        }),
        signOut: vi.fn(),
      },
    } as unknown as ReturnType<typeof createServerClient>)

    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      authId: 'auth-1',
      email: 'user@test.com',
      role: 'VISITOR',
      isActive: false,
    })

    try {
      await handler(makePostEvent({
        email: 'user@test.com',
        password: 'password123',
      }))
      expect.unreachable('should have thrown')
    }
    catch (error) {
      const err = error as { statusCode: number, data?: { code?: string } }
      expect(err.statusCode).toBe(403)
      expect(err.data?.code).toBe('FORBIDDEN')
    }
  })
})

describe('GET /api/auth/me', () => {
  let handler: (_event: ReturnType<typeof makeGetEvent>) => Promise<unknown>

  beforeEach(async () => {
    vi.clearAllMocks()

    const mod = await import('../../../server/api/auth/me.get')
    handler = mod.default as unknown as (_event: ReturnType<typeof makeGetEvent>) => Promise<unknown>
  })

  it('returns user null when not authenticated', async () => {
    mockCreateServerClient.mockReturnValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: null },
          error: { message: 'No session' },
        }),
      },
    } as unknown as ReturnType<typeof createServerClient>)

    const result = await handler(makeGetEvent())

    expect(result).toEqual({ user: null })
  })

  it('returns user when authenticated', async () => {
    mockCreateServerClient.mockReturnValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'auth-1', email: 'test@test.com' } },
          error: null,
        }),
      },
    } as unknown as ReturnType<typeof createServerClient>)

    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      authId: 'auth-1',
      email: 'test@test.com',
      role: 'VISITOR',
    })

    const result = await handler(makeGetEvent()) as { user: { id: string } }

    expect(result.user).toBeTruthy()
    expect(result.user.id).toBe('user-1')
  })
})
