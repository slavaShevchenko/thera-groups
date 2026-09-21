import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createEvent } from 'h3'

vi.mock('~~/server/utils/supabase', () => ({
  createServerClient: vi.fn(),
}))

vi.mock('~~/server/utils/prisma', () => ({ prisma: globalThis.prisma }))

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- globalThis.prisma is set in test setup
const prisma = globalThis.prisma as any

// eslint-disable-next-line import/first -- import must follow vi.mock()
import { getUser, requireAuth, requireRole } from '../../server/utils/auth'
// eslint-disable-next-line import/first -- import must follow vi.mock()
import { requirePermission } from '../../server/utils/permissions'
// eslint-disable-next-line import/first -- import must follow vi.mock()
import { createServerClient } from '~~/server/utils/supabase'

const mockCreateServerClient = vi.mocked(createServerClient)

function makeMockEvent() {
  return createEvent({ url: '/test', method: 'GET' }, {})
}

function mockSupabaseAuth(authUser: { id: string, email?: string } | null, error: unknown = null) {
  mockCreateServerClient.mockReturnValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: authUser },
        error,
      }),
    },
  }) as unknown as ReturnType<typeof createServerClient>
}

describe('getUser', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns user when valid Supabase session exists', async () => {
    mockSupabaseAuth({ id: 'auth-1', email: 'test@test.com' })

    prisma.user.upsert.mockResolvedValue({
      id: 'user-1',
      authId: 'auth-1',
      email: 'test@test.com',
      role: 'VISITOR',
      organizerProfile: null,
    })

    const user = await getUser(makeMockEvent())

    expect(user).toBeTruthy()
    expect(user!.id).toBe('user-1')
    expect(user!.authId).toBe('auth-1')
  })

  it('returns null when Supabase returns error', async () => {
    mockSupabaseAuth(null, { message: 'Invalid session' })

    const user = await getUser(makeMockEvent())

    expect(user).toBeNull()
  })

  it('returns null when no auth user', async () => {
    mockSupabaseAuth(null)

    const user = await getUser(makeMockEvent())

    expect(user).toBeNull()
  })

  it('auto-creates Prisma user for valid auth user without record via upsert', async () => {
    mockSupabaseAuth({ id: 'auth-new', email: 'new@test.com' })

    prisma.user.upsert.mockResolvedValue({
      id: 'user-new',
      authId: 'auth-new',
      email: 'new@test.com',
      role: 'VISITOR',
      organizerProfile: null,
    })

    const user = await getUser(makeMockEvent())

    expect(user).toBeTruthy()
    expect(user!.id).toBe('user-new')
    expect(prisma.user.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { authId: 'auth-new' },
        create: expect.objectContaining({
          authId: 'auth-new',
          email: 'new@test.com',
          role: 'VISITOR',
        }),
      }),
    )
  })

  it('does not auto-create when auth user has no email', async () => {
    mockSupabaseAuth({ id: 'auth-no-email' })

    const user = await getUser(makeMockEvent())

    expect(user).toBeNull()
    expect(prisma.user.upsert).not.toHaveBeenCalled()
  })
})

describe('requireAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns user when authenticated', async () => {
    mockSupabaseAuth({ id: 'auth-1', email: 'test@test.com' })

    prisma.user.upsert.mockResolvedValue({
      id: 'user-1',
      authId: 'auth-1',
      email: 'test@test.com',
      role: 'VISITOR',
    })

    const user = await requireAuth(makeMockEvent())

    expect(user.id).toBe('user-1')
  })

  it('throws 401 when not authenticated', async () => {
    mockSupabaseAuth(null)

    await expect(requireAuth(makeMockEvent())).rejects.toMatchObject({
      statusCode: 401,
      statusMessage: 'Unauthorized',
    })
  })
})

describe('requireRole', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns user when role matches', async () => {
    mockSupabaseAuth({ id: 'auth-1', email: 'admin@test.com' })

    prisma.user.upsert.mockResolvedValue({
      id: 'user-1',
      authId: 'auth-1',
      email: 'admin@test.com',
      role: 'ADMIN',
    })

    const user = await requireRole(makeMockEvent(), ['ADMIN'])

    expect(user.role).toBe('ADMIN')
  })

  it('throws 403 when role does not match', async () => {
    mockSupabaseAuth({ id: 'auth-1', email: 'visitor@test.com' })

    prisma.user.upsert.mockResolvedValue({
      id: 'user-1',
      authId: 'auth-1',
      email: 'visitor@test.com',
      role: 'VISITOR',
    })

    await expect(
      requireRole(makeMockEvent(), ['ADMIN', 'ORGANIZER']),
    ).rejects.toMatchObject({
      statusCode: 403,
      statusMessage: 'Forbidden',
    })
  })

  it('throws 401 when not authenticated', async () => {
    mockSupabaseAuth(null)

    await expect(
      requireRole(makeMockEvent(), ['ADMIN']),
    ).rejects.toMatchObject({
      statusCode: 401,
    })
  })
})

describe('requirePermission', () => {
  it('does not throw when user has permission', () => {
    const admin = { id: 'admin-1', role: 'ADMIN' } as Parameters<typeof requirePermission>[0]

    expect(() => requirePermission(admin, 'admin.panel')).not.toThrow()
  })

  it('throws 403 when user lacks permission', () => {
    const visitor = { id: 'vis-1', role: 'VISITOR' } as Parameters<typeof requirePermission>[0]

    expect(() => requirePermission(visitor, 'admin.panel')).toThrow()
  })

  it('checks resource-based permissions', () => {
    const organizer = { id: 'org-1', role: 'ORGANIZER' } as Parameters<typeof requirePermission>[0]
    const ownResource = { organizerUserId: 'org-1' }

    expect(() => requirePermission(organizer, 'group.edit', ownResource)).not.toThrow()
  })

  it('denies resource-based permission for non-owner', () => {
    const organizer = { id: 'org-2', role: 'ORGANIZER' } as Parameters<typeof requirePermission>[0]
    const someoneElsesResource = { organizerUserId: 'org-1' }

    expect(() => requirePermission(organizer, 'group.edit', someoneElsesResource)).toThrow()
  })
})
