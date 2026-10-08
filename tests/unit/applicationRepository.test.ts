import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('~~/server/utils/prisma', () => ({ prisma: globalThis.prisma }))

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- globalThis.prisma is set in test setup
const prisma = globalThis.prisma as any

// eslint-disable-next-line import/first -- import must follow vi.mock()
import { applicationRepository } from '../../server/repositories/applicationRepository'

// The email arm of the OR is permanent, not a migration shim: a guest applies without
// an account, so `Application.userId` stays NULL, and matching on email is what lets
// that person see the application after registering with the same address.
describe('applicationRepository.findMyApplications', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prisma.application.findMany.mockResolvedValue([])
  })

  it('matches by userId or email for an authenticated caller', async () => {
    await applicationRepository.findMyApplications({ userId: 'user-1', email: 'me@test.com' })

    expect(prisma.application.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { OR: [{ userId: 'user-1' }, { email: 'me@test.com' }] },
      }),
    )
  })

  it('matches by email alone when no userId is supplied', async () => {
    await applicationRepository.findMyApplications({ email: 'me@test.com' })

    expect(prisma.application.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { email: 'me@test.com' } }),
    )
  })

  it('orders newest first and caps the result set', async () => {
    await applicationRepository.findMyApplications({ userId: 'user-1', email: 'me@test.com' })

    expect(prisma.application.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 50, orderBy: { createdAt: 'desc' } }),
    )
  })
})
