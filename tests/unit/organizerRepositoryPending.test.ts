import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('~~/server/utils/prisma', () => ({ prisma: globalThis.prisma }))

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- globalThis.prisma is set in test setup
const prisma = globalThis.prisma as any

// eslint-disable-next-line import/first -- import must follow vi.mock()
import { organizerRepository } from '../../server/repositories/organizerRepository'

/**
 * The moderation queue is a paginated list like every other admin read. It used to be a
 * bare `findMany` with no `take`, so the response grew with the backlog and the panel had
 * no way to tell how deep the queue actually was.
 */
describe('organizerRepository.findPendingVerification', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prisma.organizerProfile.findMany.mockResolvedValue([])
    prisma.organizerProfile.count.mockResolvedValue(0)
  })

  it('reads only PENDING profiles, longest-waiting first', async () => {
    await organizerRepository.findPendingVerification({ skip: 0, take: 20 })

    expect(prisma.organizerProfile.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { verificationStatus: 'PENDING' },
        orderBy: { createdAt: 'asc' },
      }),
    )
  })

  it('bounds the page and counts the whole queue, not just the rows returned', async () => {
    prisma.organizerProfile.count.mockResolvedValue(53)

    const { profiles, total } = await organizerRepository.findPendingVerification({ skip: 20, take: 20 })

    expect(prisma.organizerProfile.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 20, take: 20 }),
    )
    // The count is unpaginated on purpose: it is what the tab badge and `totalPages` read.
    expect(prisma.organizerProfile.count).toHaveBeenCalledWith({
      where: { verificationStatus: 'PENDING' },
    })
    expect(profiles).toEqual([])
    expect(total).toBe(53)
  })
})
