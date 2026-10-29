import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('~~/server/utils/prisma', () => ({ prisma: globalThis.prisma }))

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- globalThis.prisma is set in test setup
const prisma = globalThis.prisma as any

// eslint-disable-next-line import/first -- import must follow vi.mock()
import { organizerRepository } from '../../server/repositories/organizerRepository'
// eslint-disable-next-line import/first -- import must follow vi.mock()
import { PUBLIC_GROUP_STATUSES } from '../../shared/constants/groupStatus'

const DAY = 86_400_000

function group(slug: string, overrides: Record<string, unknown> = {}) {
  return { slug, title: slug, status: 'PUBLISHED', startsAt: null, endsAt: null, ...overrides }
}

describe('organizerRepository.findBySlugWithGroups', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('lists what has not ended before the archive, whatever order the rows arrived in', async () => {
    prisma.organizerProfile.findUnique.mockResolvedValue({
      slug: 'org-1',
      groups: [
        group('ended-last-year', { status: 'COMPLETED', startsAt: new Date(Date.now() - 300 * DAY) }),
        group('next-month', { startsAt: new Date(Date.now() + 30 * DAY) }),
        group('running-now', { startsAt: new Date(Date.now() - DAY), endsAt: new Date(Date.now() + DAY) }),
        group('next-week', { startsAt: new Date(Date.now() + 7 * DAY) }),
      ],
    })

    const profile = await organizerRepository.findBySlugWithGroups('org-1')

    // The catalog's order: still open soonest first, the archive behind. A group running
    // right now is the most relevant thing on the profile, and the plain `startsAt: 'asc'`
    // this replaced opened every profile onto last year's groups instead.
    expect(profile!.groups.map((g: { slug: string }) => g.slug))
      .toEqual(['running-now', 'next-week', 'next-month', 'ended-last-year'])
  })

  it('asks for the publicly visible statuses and decides the order itself', async () => {
    prisma.organizerProfile.findUnique.mockResolvedValue({ slug: 'org-1', groups: [] })

    await organizerRepository.findBySlugWithGroups('org-1')

    const { select } = prisma.organizerProfile.findUnique.mock.calls[0][0]
    expect([...select.groups.where.status.in].sort()).toEqual([...PUBLIC_GROUP_STATUSES].sort())
    // The nested select must not claim an order of its own, or the two rules would fight.
    expect(select.groups.orderBy).toBeUndefined()
  })

  it('returns null for a slug that does not exist', async () => {
    prisma.organizerProfile.findUnique.mockResolvedValue(null)

    expect(await organizerRepository.findBySlugWithGroups('nope')).toBeNull()
  })
})
