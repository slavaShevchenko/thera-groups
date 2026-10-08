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

vi.mock('~~/server/utils/supabase', async (importOriginal) => {
  // Keep the real findAuthUsersByEmail: paginating GoTrue's /admin/users is the
  // behaviour under test, only the client factories are replaced.
  const actual = await importOriginal<typeof import('~~/server/utils/supabase')>()
  return {
    ...actual,
    createServerClient: vi.fn(),
    createAdminClient: vi.fn(),
  }
})

vi.mock('~~/server/utils/prisma', () => ({ prisma: globalThis.prisma }))

vi.mock('~~/server/utils/slugify', () => ({
  generateUniqueSlug: vi.fn((name: string) => Promise.resolve(name.toLowerCase().replace(/\s+/g, '-'))),
}))

vi.mock('~~/server/utils/notifications', () => ({
  notifyAdminsOrganizerPendingReview: vi.fn(),
  notifyOrganizerWelcome: vi.fn(),
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

// GoTrue serves /admin/users 50 at a time and ignores a larger perPage.
const GOTRUE_MAX_PER_PAGE = 50
const ALREADY_REGISTERED = {
  message: 'A user with this email address has already been registered',
  code: 'email_exists',
}

type FakeAuthUser = { id: string, email: string }

/**
 * Stands in for `supabase.auth.admin` with GoTrue's real semantics: createUser
 * refuses an address already present, listUsers paginates and caps perPage.
 */
function makeFakeAdminApi(seed: FakeAuthUser[] = []) {
  const users: FakeAuthUser[] = [...seed]
  const listUsersCalls: { page?: number, perPage?: number }[] = []
  const deletedIds: string[] = []

  const withEmail = (email: string) =>
    users.filter(u => u.email.trim().toLowerCase() === email.trim().toLowerCase())

  const admin = {
    createUser: vi.fn(async ({ email }: { email: string }) => {
      if (withEmail(email).length) {
        return { data: { user: null }, error: ALREADY_REGISTERED }
      }

      const user = { id: `auth-created-${users.length + 1}`, email }
      users.push(user)
      return { data: { user }, error: null }
    }),

    listUsers: vi.fn(async (params?: { page?: number, perPage?: number }) => {
      listUsersCalls.push(params ?? {})

      const perPage = Math.min(params?.perPage ?? GOTRUE_MAX_PER_PAGE, GOTRUE_MAX_PER_PAGE)
      const page = params?.page ?? 1
      const start = (page - 1) * perPage
      const lastPage = Math.max(1, Math.ceil(users.length / perPage))

      return {
        data: {
          users: users.slice(start, start + perPage),
          aud: 'authenticated',
          nextPage: page < lastPage ? page + 1 : null,
          lastPage,
          total: users.length,
        },
        error: null,
      }
    }),

    deleteUser: vi.fn(async (id: string) => {
      deletedIds.push(id)

      const index = users.findIndex(u => u.id === id)
      if (index === -1) return { data: null, error: { message: 'User not found' } }

      users.splice(index, 1)
      return { data: null, error: null }
    }),
  }

  return { admin, users, listUsersCalls, deletedIds }
}

function makeAuthUsers(count: number, prefix = 'filler'): FakeAuthUser[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `auth-${prefix}-${i + 1}`,
    email: `${prefix}${i + 1}@test.com`,
  }))
}

describe('POST /api/auth/register', () => {
  let handler: (_event: ReturnType<typeof makePostEvent>) => Promise<unknown>

  function useAdminApi(seed: FakeAuthUser[] = []) {
    const fake = makeFakeAdminApi(seed)
    mockCreateAdminClient.mockReturnValue({
      auth: { admin: fake.admin },
    } as unknown as ReturnType<typeof createAdminClient>)
    return fake
  }

  beforeEach(async () => {
    vi.clearAllMocks()

    useAdminApi()
    prisma.user.findUnique.mockResolvedValue(null)

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

  it('welcomes a new ORGANIZER and tells them verification is pending', async () => {
    const { notifyAdminsOrganizerPendingReview, notifyOrganizerWelcome }
      = await import('~~/server/utils/notifications')

    prisma.user.create.mockResolvedValue({
      id: 'user-1',
      email: 'org@test.com',
      role: 'ORGANIZER',
    })
    prisma.organizerProfile.create.mockResolvedValue({ id: 'profile-1', slug: 'ivan-petrenko' })
    prisma.organizerProfile.findUnique.mockResolvedValue({
      id: 'profile-1',
      firstName: 'Ivan',
      lastName: 'Petrenko',
      verificationStatus: 'PENDING',
    })

    const result = await handler(makePostEvent({
      email: 'org@test.com',
      password: 'password123',
      role: 'ORGANIZER',
      preferredLocale: 'en',
      organizerData: { firstName: 'Ivan', lastName: 'Petrenko' },
    })) as { success: boolean }

    expect(result.success).toBe(true)
    expect(notifyAdminsOrganizerPendingReview).toHaveBeenCalledWith('Ivan Petrenko', 'ivan-petrenko')
    // The welcome goes to the address and locale from the request, keyed to the new user.
    expect(notifyOrganizerWelcome)
      .toHaveBeenCalledWith('user-1', 'org@test.com', 'Ivan', 'ivan-petrenko', 'en')
  })

  it('defaults the welcome locale to Ukrainian', async () => {
    const { notifyOrganizerWelcome } = await import('~~/server/utils/notifications')

    prisma.user.create.mockResolvedValue({
      id: 'user-1',
      email: 'org@test.com',
      role: 'ORGANIZER',
    })
    prisma.organizerProfile.create.mockResolvedValue({ id: 'profile-1', slug: 'ivan-petrenko' })
    prisma.organizerProfile.findUnique.mockResolvedValue({
      id: 'profile-1',
      firstName: 'Ivan',
      lastName: 'Petrenko',
      verificationStatus: 'PENDING',
    })

    await handler(makePostEvent({
      email: 'org@test.com',
      password: 'password123',
      role: 'ORGANIZER',
      organizerData: { firstName: 'Ivan', lastName: 'Petrenko' },
    }))

    expect(notifyOrganizerWelcome)
      .toHaveBeenCalledWith('user-1', 'org@test.com', 'Ivan', 'ivan-petrenko', 'ua')
  })

  it('sends a VISITOR no organizer welcome', async () => {
    const { notifyOrganizerWelcome } = await import('~~/server/utils/notifications')

    prisma.user.create.mockResolvedValue({
      id: 'user-1',
      email: 'visitor@test.com',
      role: 'VISITOR',
    })

    await handler(makePostEvent({
      email: 'visitor@test.com',
      password: 'password123',
      role: 'VISITOR',
    }))

    expect(notifyOrganizerWelcome).not.toHaveBeenCalled()
  })

  it('sends no welcome when the profile write fails and the sign-up is rolled back', async () => {
    const admin = useAdminApi()
    const { notifyOrganizerWelcome } = await import('~~/server/utils/notifications')

    prisma.user.create.mockResolvedValue({
      id: 'user-1',
      email: 'org@test.com',
      role: 'ORGANIZER',
    })
    prisma.organizerProfile.create.mockRejectedValue(new Error('write failed'))

    await expect(handler(makePostEvent({
      email: 'org@test.com',
      password: 'password123',
      role: 'ORGANIZER',
      organizerData: { firstName: 'Ivan', lastName: 'Petrenko' },
    }))).rejects.toThrow()

    expect(notifyOrganizerWelcome).not.toHaveBeenCalled()
    expect(admin.deletedIds).toHaveLength(1)
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

  it('clears an orphaned auth.users record that sits past the first GoTrue page', async () => {
    // 60 fillers push the orphan onto page 2, which the unpaged lookup never read.
    const admin = useAdminApi([
      ...makeAuthUsers(60),
      { id: 'auth-orphan', email: 'orphan@test.com' },
    ])

    prisma.user.create.mockResolvedValue({
      id: 'user-1',
      email: 'orphan@test.com',
      role: 'VISITOR',
    })

    const result = await handler(makePostEvent({
      email: 'orphan@test.com',
      password: 'password123',
      role: 'VISITOR',
    })) as { success: boolean }

    expect(result.success).toBe(true)
    expect(admin.deletedIds).toEqual(['auth-orphan'])
    expect(admin.listUsersCalls[0]).toEqual({ page: 1, perPage: 1000 })
    expect(admin.listUsersCalls.length).toBeGreaterThan(1)
    expect(prisma.user.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ authId: 'auth-created-61' }),
    }))
  })

  it('clears every orphaned record for one address, matching case-insensitively', async () => {
    const admin = useAdminApi([
      ...makeAuthUsers(55),
      { id: 'auth-orphan-a', email: 'dupe@test.com' },
      ...makeAuthUsers(3, 'more'),
      { id: 'auth-orphan-b', email: 'Dupe@Test.com' },
    ])

    prisma.user.create.mockResolvedValue({
      id: 'user-1',
      email: 'dupe@test.com',
      role: 'VISITOR',
    })

    const result = await handler(makePostEvent({
      email: 'dupe@test.com',
      password: 'password123',
      role: 'VISITOR',
    })) as { success: boolean }

    expect(result.success).toBe(true)
    expect(admin.deletedIds).toEqual(['auth-orphan-a', 'auth-orphan-b'])
  })

  it('returns 409 CONFLICT and keeps the auth account when public.User has the email', async () => {
    const admin = useAdminApi([{ id: 'auth-real', email: 'taken@test.com' }])

    prisma.user.findUnique.mockResolvedValue({ id: 'user-1', email: 'taken@test.com' })

    try {
      await handler(makePostEvent({
        email: 'taken@test.com',
        password: 'password123',
        role: 'VISITOR',
      }))
      expect.unreachable('should have thrown')
    }
    catch (error) {
      const err = error as { statusCode: number, statusMessage: string, data?: { code?: string } }
      expect(err.statusCode).toBe(409)
      expect(err.data?.code).toBe('CONFLICT')
      // useUser().register() keys the localized hint off this exact string.
      expect(err.statusMessage).toBe('User with this email already exists')
    }

    expect(admin.deletedIds).toEqual([])
  })

  it('returns 409 instead of 500 when the conflicting account cannot be listed', async () => {
    const admin = useAdminApi([{ id: 'auth-orphan', email: 'orphan@test.com' }])
    admin.admin.listUsers.mockResolvedValue({
      data: { users: [] },
      error: { message: 'Invalid API key' },
    } as unknown as Awaited<ReturnType<typeof admin.admin.listUsers>>)

    try {
      await handler(makePostEvent({
        email: 'orphan@test.com',
        password: 'password123',
        role: 'VISITOR',
      }))
      expect.unreachable('should have thrown')
    }
    catch (error) {
      const err = error as { statusCode: number, data?: { code?: string } }
      expect(err.statusCode).toBe(409)
      expect(err.data?.code).toBe('CONFLICT')
    }

    expect(admin.deletedIds).toEqual([])
  })

  it('returns 409 when the orphan survives deletion and the retry conflicts again', async () => {
    const admin = useAdminApi([{ id: 'auth-stuck', email: 'stuck@test.com' }])
    admin.admin.deleteUser.mockResolvedValue({
      data: null,
      error: { message: 'User not found' },
    } as unknown as Awaited<ReturnType<typeof admin.admin.deleteUser>>)

    try {
      await handler(makePostEvent({
        email: 'stuck@test.com',
        password: 'password123',
        role: 'VISITOR',
      }))
      expect.unreachable('should have thrown')
    }
    catch (error) {
      const err = error as { statusCode: number, data?: { code?: string } }
      expect(err.statusCode).toBe(409)
      expect(err.data?.code).toBe('CONFLICT')
    }

    expect(admin.admin.createUser).toHaveBeenCalledTimes(2)
  })

  it('returns 500 INTERNAL when Supabase rejects sign-up for an unrelated reason', async () => {
    const admin = useAdminApi()
    admin.admin.createUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'Database error saving new user' },
    } as unknown as Awaited<ReturnType<typeof admin.admin.createUser>>)

    try {
      await handler(makePostEvent({
        email: 'fresh@test.com',
        password: 'password123',
        role: 'VISITOR',
      }))
      expect.unreachable('should have thrown')
    }
    catch (error) {
      const err = error as { statusCode: number, data?: { code?: string }, cause?: Error }
      expect(err.statusCode).toBe(500)
      expect(err.data?.code).toBe('INTERNAL')
      expect(err.cause?.message).toBe('Database error saving new user')
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

    prisma.user.upsert.mockResolvedValue({
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
