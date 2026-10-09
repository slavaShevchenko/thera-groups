import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const ADMIN_EMAIL = 'owner@psygroup.org'
const ADMIN_PASSWORD = 'supplied-only-through-env'

const { adminClient, findAuthUsersByEmailMock, serverConfig } = vi.hoisted(() => ({
  adminClient: {
    auth: {
      admin: {
        createUser: vi.fn(),
        deleteUser: vi.fn(),
      },
    },
  },
  findAuthUsersByEmailMock: vi.fn(),
  serverConfig: { adminEmail: '', adminPassword: '' },
}))

vi.mock('~~/server/utils/supabase', () => ({
  createAdminClient: () => adminClient,
  findAuthUsersByEmail: findAuthUsersByEmailMock,
}))

vi.mock('~~/server/utils/config', () => ({
  useServerConfig: () => serverConfig,
}))

// eslint-disable-next-line import/first -- import must follow vi.mock()
import { bootstrapFirstAdmin } from '~~/server/utils/bootstrap'

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- globalThis.prisma is set in test setup
const prisma = globalThis.prisma as any

const mockCreateUser = vi.mocked(adminClient.auth.admin.createUser)
const mockDeleteUser = vi.mocked(adminClient.auth.admin.deleteUser)

function authUser(id = 'auth-1') {
  return { data: { user: { id, email: ADMIN_EMAIL } }, error: null }
}

let logSpies: ReturnType<typeof vi.spyOn>[]

beforeEach(() => {
  vi.clearAllMocks()

  serverConfig.adminEmail = ADMIN_EMAIL
  serverConfig.adminPassword = ADMIN_PASSWORD

  prisma.user.count.mockResolvedValue(0)
  prisma.user.findUnique.mockResolvedValue(null)
  prisma.user.create.mockResolvedValue({ id: 'user-admin', email: ADMIN_EMAIL, role: 'ADMIN' })
  prisma.user.update.mockResolvedValue({ id: 'user-1', role: 'ADMIN' })
  findAuthUsersByEmailMock.mockResolvedValue([])
  mockCreateUser.mockResolvedValue(authUser())
  mockDeleteUser.mockResolvedValue({ data: null, error: null })

  logSpies = [
    vi.spyOn(console, 'log').mockImplementation(() => {}),
    vi.spyOn(console, 'warn').mockImplementation(() => {}),
    vi.spyOn(console, 'error').mockImplementation(() => {}),
  ]
})

afterEach(() => {
  for (const spy of logSpies) spy.mockRestore()
})

/**
 * A fresh production database has no ADMIN: the seed refuses to run there and registration
 * only creates VISITOR or ORGANIZER. The bootstrap is the only way in, and it runs on every
 * cold start — so the "admin already exists" path has to stay a single count, and no failure
 * here may take the application down.
 */
describe('bootstrapFirstAdmin', () => {
  it('does nothing when an admin already exists', async () => {
    prisma.user.count.mockResolvedValue(1)

    await expect(bootstrapFirstAdmin()).resolves.toBe('already-present')

    expect(prisma.user.count).toHaveBeenCalledWith({ where: { role: 'ADMIN' } })
    expect(prisma.user.create).not.toHaveBeenCalled()
    expect(mockCreateUser).not.toHaveBeenCalled()
  })

  it('warns and stops when the env variables are missing', async () => {
    serverConfig.adminEmail = ''
    serverConfig.adminPassword = ''

    await expect(bootstrapFirstAdmin()).resolves.toBe('not-configured')

    expect(prisma.user.create).not.toHaveBeenCalled()
    expect(mockCreateUser).not.toHaveBeenCalled()
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('ADMIN_EMAIL/ADMIN_PASSWORD not set'),
    )
  })

  it('warns when only one of the two variables is set', async () => {
    serverConfig.adminPassword = ''

    await expect(bootstrapFirstAdmin()).resolves.toBe('not-configured')

    expect(prisma.user.create).not.toHaveBeenCalled()
  })

  it('creates the auth account and the ADMIN row on an empty database', async () => {
    await expect(bootstrapFirstAdmin()).resolves.toBe('created')

    expect(mockCreateUser).toHaveBeenCalledWith({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      email_confirm: true,
    })
    expect(prisma.user.create).toHaveBeenCalledWith({
      data: { authId: 'auth-1', email: ADMIN_EMAIL, role: 'ADMIN', isActive: true },
    })
  })

  it('promotes an existing account instead of recreating its auth user', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'user-1', email: ADMIN_EMAIL, role: 'VISITOR' })

    await expect(bootstrapFirstAdmin()).resolves.toBe('promoted')

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { role: 'ADMIN', isActive: true },
    })
    expect(mockDeleteUser).not.toHaveBeenCalled()
    expect(prisma.user.create).not.toHaveBeenCalled()
  })

  it('clears an orphaned auth user and replays the create', async () => {
    findAuthUsersByEmailMock.mockResolvedValue([{ id: 'auth-orphan' }])
    mockCreateUser
      .mockResolvedValueOnce({ data: null, error: { message: 'User already been registered' } } as never)
      .mockResolvedValueOnce(authUser('auth-2'))

    await expect(bootstrapFirstAdmin()).resolves.toBe('created')

    expect(mockDeleteUser).toHaveBeenCalledWith('auth-orphan')
    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ authId: 'auth-2' }) }),
    )
  })

  it('treats a P2002 race as another instance having won', async () => {
    prisma.user.create.mockRejectedValue({ code: 'P2002', message: 'Unique constraint failed' })

    await expect(bootstrapFirstAdmin()).resolves.toBe('already-present')

    expect(console.error).not.toHaveBeenCalled()
  })

  it('survives a Supabase failure without throwing', async () => {
    mockCreateUser.mockResolvedValue({ data: null, error: { message: 'service down' } } as never)

    await expect(bootstrapFirstAdmin()).resolves.toBe('failed')

    expect(prisma.user.create).not.toHaveBeenCalled()
    expect(console.error).toHaveBeenCalled()
  })

  it('survives a database failure without throwing', async () => {
    prisma.user.count.mockRejectedValue({ code: 'P1001', message: 'Can\'t reach database server' })

    await expect(bootstrapFirstAdmin()).resolves.toBe('failed')

    expect(console.error).toHaveBeenCalled()
  })

  it('never puts the password on a log line', async () => {
    mockCreateUser.mockResolvedValue({ data: null, error: { message: 'service down' } } as never)

    await bootstrapFirstAdmin()

    const logged = logSpies.flatMap(spy => spy.mock.calls.flat())
      .map(arg => (typeof arg === 'string' ? arg : JSON.stringify(arg)))
      .join('\n')

    expect(logged).not.toContain(ADMIN_PASSWORD)
  })
})
