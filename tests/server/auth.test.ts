import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createEvent } from 'h3'

vi.mock('~~/server/utils/supabase', () => ({
  createServerClient: vi.fn(),
}))

vi.mock('~~/server/utils/prisma', () => ({ prisma: globalThis.prisma }))

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- globalThis.prisma is set in test setup
const prisma = globalThis.prisma as any

// eslint-disable-next-line import/first -- import must follow vi.mock()
import { getUser, requireAuth } from '../../server/utils/auth'
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
  const stored = (overrides: Record<string, unknown> = {}) => ({
    id: 'user-1',
    authId: 'auth-1',
    email: 'test@test.com',
    role: 'VISITOR',
    isActive: true,
    organizerProfile: null,
    ...overrides,
  })

  beforeEach(() => {
    vi.clearAllMocks()
    prisma.user.findUnique.mockReset().mockResolvedValue(null)
    prisma.user.create.mockReset()
    prisma.user.update.mockReset()
  })

  it('returns user when valid Supabase session exists', async () => {
    mockSupabaseAuth({ id: 'auth-1', email: 'test@test.com' })
    prisma.user.findUnique.mockResolvedValue(stored())

    const user = await getUser(makeMockEvent())

    expect(user).toBeTruthy()
    expect(user!.id).toBe('user-1')
    expect(user!.authId).toBe('auth-1')
    expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { authId: 'auth-1' } })
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

  it('writes nothing at all when the stored address already matches', async () => {
    // This runs on every authenticated request, including read-only ones. The upsert it
    // replaced issued a write each time.
    mockSupabaseAuth({ id: 'auth-1', email: 'test@test.com' })
    prisma.user.findUnique.mockResolvedValue(stored())

    await getUser(makeMockEvent())

    expect(prisma.user.create).not.toHaveBeenCalled()
    expect(prisma.user.update).not.toHaveBeenCalled()
  })

  it('creates a VISITOR row for an auth identity the database has not seen', async () => {
    mockSupabaseAuth({ id: 'auth-new', email: 'new@test.com' })
    prisma.user.create.mockResolvedValue(stored({ id: 'user-new', authId: 'auth-new', email: 'new@test.com' }))

    const user = await getUser(makeMockEvent())

    expect(user!.id).toBe('user-new')
    expect(prisma.user.create).toHaveBeenCalledWith({
      data: { authId: 'auth-new', email: 'new@test.com', role: 'VISITOR' },
    })
  })

  it('stores the address normalized, so the unique lookup can find it again', async () => {
    mockSupabaseAuth({ id: 'auth-new', email: '  New@Test.COM ' })
    prisma.user.create.mockResolvedValue(stored({ id: 'user-new', email: 'new@test.com' }))

    await getUser(makeMockEvent())

    expect(prisma.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ email: 'new@test.com' }),
    })
  })

  it('repairs a local row whose address the provider has since changed', async () => {
    mockSupabaseAuth({ id: 'auth-1', email: 'moved@test.com' })
    prisma.user.findUnique.mockResolvedValue(stored())
    prisma.user.update.mockResolvedValue(stored({ email: 'moved@test.com' }))

    const user = await getUser(makeMockEvent())

    expect(user!.email).toBe('moved@test.com')
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { email: 'moved@test.com' },
    })
    expect(prisma.user.create).not.toHaveBeenCalled()
  })

  it('keeps the stored row when the new address already belongs to another account', async () => {
    // Adopting the other row would hand this session somebody else's groups.
    mockSupabaseAuth({ id: 'auth-1', email: 'taken@test.com' })
    prisma.user.findUnique.mockResolvedValue(stored())
    prisma.user.update.mockRejectedValue({ code: 'P2002', meta: { target: ['email'] } })

    const user = await getUser(makeMockEvent())

    expect(user!.email).toBe('test@test.com')
  })

  it('reads the row back when two requests from one new session race to create it', async () => {
    mockSupabaseAuth({ id: 'auth-new', email: 'new@test.com' })
    prisma.user.create.mockRejectedValue({ code: 'P2002', meta: { target: ['authId'] } })
    prisma.user.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(stored({ id: 'user-new', authId: 'auth-new', email: 'new@test.com' }))

    const user = await getUser(makeMockEvent())

    expect(user!.id).toBe('user-new')
    expect(prisma.user.findUnique).toHaveBeenCalledTimes(2)
  })

  it('does not swallow a database failure that is not a collision', async () => {
    mockSupabaseAuth({ id: 'auth-new', email: 'new@test.com' })
    prisma.user.create.mockRejectedValue({ code: 'P1001', message: 'Can\'t reach database server' })

    await expect(getUser(makeMockEvent())).rejects.toMatchObject({ code: 'P1001' })
  })

  it('does not auto-create when auth user has no email', async () => {
    mockSupabaseAuth({ id: 'auth-no-email' })

    const user = await getUser(makeMockEvent())

    expect(user).toBeNull()
    expect(prisma.user.findUnique).not.toHaveBeenCalled()
    expect(prisma.user.create).not.toHaveBeenCalled()
  })

  it('asks for the organizer profile only when the caller wants it', async () => {
    mockSupabaseAuth({ id: 'auth-1', email: 'test@test.com' })
    prisma.user.findUnique.mockResolvedValue(stored())

    await getUser(makeMockEvent())
    expect(prisma.user.findUnique).toHaveBeenLastCalledWith({ where: { authId: 'auth-1' } })

    await getUser(makeMockEvent(), { withProfile: true })
    expect(prisma.user.findUnique).toHaveBeenLastCalledWith({
      where: { authId: 'auth-1' },
      include: { organizerProfile: true },
    })
  })
})

describe('requireAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prisma.user.findUnique.mockReset().mockResolvedValue(null)
  })

  it('returns user when authenticated', async () => {
    mockSupabaseAuth({ id: 'auth-1', email: 'test@test.com' })

    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      authId: 'auth-1',
      email: 'test@test.com',
      role: 'VISITOR',
      isActive: true,
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

  it('throws 403 FORBIDDEN when the account was deactivated after sign-in', async () => {
    mockSupabaseAuth({ id: 'auth-1', email: 'test@test.com' })

    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      authId: 'auth-1',
      email: 'test@test.com',
      role: 'ORGANIZER',
      isActive: false,
    })

    await expect(requireAuth(makeMockEvent())).rejects.toMatchObject({
      statusCode: 403,
      statusMessage: 'Account disabled',
      data: { code: 'FORBIDDEN' },
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
