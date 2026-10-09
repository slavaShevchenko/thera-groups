import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('~~/server/utils/prisma', () => ({ prisma: globalThis.prisma }))

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- globalThis.prisma is set in test setup
const prisma = globalThis.prisma as any

// eslint-disable-next-line import/first -- import must follow vi.mock()
import { groupRepository } from '../../server/repositories/groupRepository'
// eslint-disable-next-line import/first -- import must follow vi.mock()
import { PUBLIC_GROUP_STATUSES } from '../../shared/constants/groupStatus'

function makeRow(slug: string, overrides: Record<string, unknown> = {}) {
  return { id: `id-${slug}`, slug, title: slug, status: 'PUBLISHED', ...overrides }
}

describe('groupRepository.findPublished — visibility', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prisma.group.count.mockResolvedValue(0)
    prisma.group.findMany.mockResolvedValue([])
  })

  it('asks for every publicly visible status, not just PUBLISHED', async () => {
    await groupRepository.findPublished()

    const { where } = prisma.group.findMany.mock.calls[0][0]
    expect([...where.status.in].sort()).toEqual([...PUBLIC_GROUP_STATUSES].sort())
    expect(where.status.in).toContain('FULL')
    expect(where.status.in).toContain('COMPLETED')
  })

  it.each(['DRAFT', 'PENDING_REVIEW', 'REJECTED', 'CANCELLED'])(
    'never asks for %s',
    async (status) => {
      await groupRepository.findPublished()

      const { where } = prisma.group.findMany.mock.calls[0][0]
      expect(where.status.in).not.toContain(status)
    },
  )

  it('puts no startsAt floor on the catalog, so a started event stays listed', async () => {
    // The detail lookup never had one, which is what left every indexed URL for a started
    // group pointing at a page the catalog no longer admitted.
    await groupRepository.findPublished()

    const { where } = prisma.group.findMany.mock.calls[0][0]
    expect(where.startsAt).toBeUndefined()
  })

  it('excludes groups whose organizer is deactivated', async () => {
    await groupRepository.findPublished()

    const { where } = prisma.group.findMany.mock.calls[0][0]
    expect(where.organizer).toEqual({ user: { isActive: true } })
  })

  it('ANDs a visitor-supplied dateFrom on top of the archive split', async () => {
    await groupRepository.findPublished({ dateFrom: '2026-12-01' })

    const upcoming = prisma.group.findMany.mock.calls[0][0].where
    const past = prisma.group.findMany.mock.calls[1][0].where

    // The floor wins over the archive: an explicit "from this date" filter must not be
    // satisfied by older events.
    expect(past.startsAt).toMatchObject({ gte: new Date('2026-12-01') })
    expect(upcoming.OR).toBeDefined()
  })
})

describe('groupRepository.findPublished — ordering and pagination', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prisma.group.findMany.mockResolvedValue([])
  })

  it('reads upcoming events soonest first and the archive most recent first', async () => {
    prisma.group.count.mockResolvedValue(0)

    await groupRepository.findPublished()

    expect(prisma.group.findMany.mock.calls[0][0].orderBy).toEqual({ startsAt: 'asc' })
    expect(prisma.group.findMany.mock.calls[1][0].orderBy).toEqual({ startsAt: 'desc' })
  })

  it('puts the archive behind the upcoming events', async () => {
    prisma.group.count.mockResolvedValue(1)
    prisma.group.findMany
      .mockResolvedValueOnce([makeRow('upcoming')])
      .mockResolvedValueOnce([makeRow('archive')])

    const groups = await groupRepository.findPublished(undefined, { skip: 0, take: 10 })

    expect(groups.map(g => g.slug)).toEqual(['upcoming', 'archive'])
  })

  it('keeps a group with no start date in the upcoming bucket rather than dropping it', async () => {
    prisma.group.count.mockResolvedValue(0)

    await groupRepository.findPublished()

    const { where } = prisma.group.findMany.mock.calls[0][0]
    expect(where.OR).toContainEqual({ startsAt: null })
  })

  it('does not query the archive when the page is already full', async () => {
    prisma.group.count.mockResolvedValue(2)
    prisma.group.findMany.mockResolvedValueOnce([makeRow('a'), makeRow('b')])

    const groups = await groupRepository.findPublished(undefined, { skip: 0, take: 2 })

    expect(groups).toHaveLength(2)
    expect(prisma.group.findMany).toHaveBeenCalledTimes(1)
  })

  it('fills the rest of the page from the archive', async () => {
    prisma.group.count.mockResolvedValue(1)
    prisma.group.findMany
      .mockResolvedValueOnce([makeRow('upcoming')])
      .mockResolvedValueOnce([makeRow('archive-1'), makeRow('archive-2')])

    const groups = await groupRepository.findPublished(undefined, { skip: 0, take: 3 })

    expect(groups.map(g => g.slug)).toEqual(['upcoming', 'archive-1', 'archive-2'])
    expect(prisma.group.findMany.mock.calls[1][0].take).toBe(2)
  })

  it('skips past the upcoming bucket when the page starts inside the archive', async () => {
    prisma.group.count.mockResolvedValue(3)
    prisma.group.findMany.mockResolvedValue([])

    await groupRepository.findPublished(undefined, { skip: 5, take: 10 })

    // Upcoming holds 3 rows, so 5 skipped means 2 into the archive.
    expect(prisma.group.findMany.mock.calls[1][0].skip).toBe(2)
  })
})

describe('groupRepository.countPublished', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prisma.group.count.mockResolvedValue(7)
  })

  it('counts over the unsplit filter, so the total does not depend on where today falls', async () => {
    const total = await groupRepository.countPublished()

    expect(total).toBe(7)
    expect(prisma.group.count).toHaveBeenCalledTimes(1)
    const { where } = prisma.group.count.mock.calls[0][0]
    expect([...where.status.in].sort()).toEqual([...PUBLIC_GROUP_STATUSES].sort())
    expect(where.OR).toBeUndefined()
  })
})

describe('groupRepository.findLatest', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prisma.group.findMany.mockResolvedValue([])
  })

  it('is a discovery surface, so it stays on upcoming events only', async () => {
    await groupRepository.findLatest(6)

    const args = prisma.group.findMany.mock.calls[0][0]
    expect(args.take).toBe(6)
    expect(args.where.OR).toHaveLength(2)
    expect(args.where.OR).toContainEqual({ startsAt: null })
    expect([...args.where.status.in].sort()).toEqual([...PUBLIC_GROUP_STATUSES].sort())
  })
})

describe('groupRepository.findBySlug — who may see a non-public group', () => {
  const row = (status: string) => ({
    ...makeRow('hidden-group', { status }),
    organizer: { id: 'profile-1', userId: 'owner-1' },
    coOrganizers: [{ userId: 'co-1', role: 'CO_ORGANIZER', user: null }],
    tags: [],
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it.each(['DRAFT', 'PENDING_REVIEW', 'REJECTED', 'CANCELLED'])(
    'returns null to an anonymous viewer for a %s group',
    async (status) => {
      prisma.group.findFirst.mockResolvedValue(row(status))

      expect(await groupRepository.findBySlug('hidden-group')).toBeNull()
    },
  )

  it('returns a CANCELLED group to its owner, who still has to see why', async () => {
    prisma.group.findFirst.mockResolvedValue(row('CANCELLED'))

    const found = await groupRepository.findBySlug('hidden-group', { userId: 'owner-1', role: 'ORGANIZER' })
    expect(found?.status).toBe('CANCELLED')
  })

  it('returns a draft to a co-organizer, who may edit but not delete it', async () => {
    prisma.group.findFirst.mockResolvedValue(row('DRAFT'))

    const found = await groupRepository.findBySlug('hidden-group', { userId: 'co-1', role: 'ORGANIZER' })
    expect(found?.status).toBe('DRAFT')
  })

  it('returns any status to an admin', async () => {
    prisma.group.findFirst.mockResolvedValue(row('REJECTED'))

    const found = await groupRepository.findBySlug('hidden-group', { userId: 'admin-1', role: 'ADMIN' })
    expect(found?.status).toBe('REJECTED')
  })

  it.each([...PUBLIC_GROUP_STATUSES])('returns a %s group to anybody', async (status) => {
    prisma.group.findFirst.mockResolvedValue(row(status))

    const found = await groupRepository.findBySlug('public-group')
    expect(found?.status).toBe(status)
  })

  it('returns null when the slug does not exist', async () => {
    prisma.group.findFirst.mockResolvedValue(null)

    expect(await groupRepository.findBySlug('nope', { userId: 'owner-1', role: 'ADMIN' })).toBeNull()
  })
})
