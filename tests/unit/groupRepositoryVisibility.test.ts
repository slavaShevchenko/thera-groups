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
    // satisfied by older events. It is read as the start of 1 December in the site zone
    // (Europe/Kyiv, UTC+2 in winter), not as UTC midnight — a group starting at 00:30 local
    // on the 1st is stored at 22:30Z on the 30th and must survive its own date filter.
    const kyivMidnight = new Date('2026-11-30T22:00:00.000Z')
    expect(upcoming.startsAt).toEqual({ gte: kyivMidnight })
    expect(past.startsAt).toEqual({ gte: kyivMidnight })
    expect(upcoming.AND).toBeDefined()
  })

  it('rejects a dateFrom that is not a calendar date', async () => {
    await expect(groupRepository.findPublished({ dateFrom: 'yesterday' }))
      .rejects
      .toMatchObject({ code: 'VALIDATION_FAILED' })
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

    // Nulls placed explicitly on both sides: `compareGroupsForListing` sorts a one-query
    // list by the same rule, and Postgres' default differs between ASC and DESC.
    expect(prisma.group.findMany.mock.calls[0][0].orderBy)
      .toEqual({ startsAt: { sort: 'asc', nulls: 'last' } })
    expect(prisma.group.findMany.mock.calls[1][0].orderBy)
      .toEqual({ startsAt: { sort: 'desc', nulls: 'last' } })
  })

  it('puts the archive behind the upcoming events', async () => {
    prisma.group.count.mockResolvedValue(1)
    prisma.group.findMany
      .mockResolvedValueOnce([makeRow('upcoming')])
      .mockResolvedValueOnce([makeRow('archive')])

    const groups = await groupRepository.findPublished(undefined, { skip: 0, take: 10 })

    expect(groups.map(g => g.slug)).toEqual(['upcoming', 'archive'])
  })

  it('splits the catalog on ended rather than started, so a group still running stays on top', async () => {
    prisma.group.count.mockResolvedValue(0)

    await groupRepository.findPublished()

    const upcoming = prisma.group.findMany.mock.calls[0][0].where
    const past = prisma.group.findMany.mock.calls[1][0].where

    // The SQL half of `isPastGroup()`: ended means the end date passed, or the start date
    // passed with no end date to wait for. Splitting on `startsAt` alone — what this used to
    // do — filed a group running right now into the archive, below events that had not begun.
    expect(past.OR).toEqual([
      { endsAt: { lt: expect.any(Date) } },
      { endsAt: null, startsAt: { lt: expect.any(Date) } },
    ])
    expect(upcoming.AND).toEqual([
      { OR: [{ endsAt: null }, { endsAt: { gte: expect.any(Date) } }] },
      { OR: [{ endsAt: { not: null } }, { startsAt: null }, { startsAt: { gte: expect.any(Date) } }] },
    ])
  })

  it('keeps a group with no dates at all in the upcoming bucket rather than dropping it', async () => {
    prisma.group.count.mockResolvedValue(0)

    await groupRepository.findPublished()

    const upcoming = prisma.group.findMany.mock.calls[0][0].where

    // Both arms matter: NULL matches no comparison, so a row with neither date would fall out
    // of the catalog entirely if the nulls were not named.
    expect(upcoming.AND[0].OR).toContainEqual({ endsAt: null })
    expect(upcoming.AND[1].OR).toContainEqual({ startsAt: null })
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

  it('is a discovery surface, so it stays on groups that have not ended', async () => {
    await groupRepository.findLatest(6)

    const args = prisma.group.findMany.mock.calls[0][0]
    expect(args.take).toBe(6)
    // The same not-ended predicate the catalog's upcoming bucket uses, so a group running
    // right now is on the home page rather than hidden with the archive.
    expect(args.where.AND).toHaveLength(2)
    expect(args.where.AND[0].OR).toContainEqual({ endsAt: null })
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

describe('groupRepository.findBySlug — a group whose organizer is gone', () => {
  // `Group.organizerId` is nullable and its foreign key is `ON DELETE SET NULL`, so a row can
  // outlive its organizer. `activeOrganizerFilter` keeps that out of this query today; what
  // is asserted here is that such a row is a data state to handle, not a TypeError. The old
  // `group.organizer!.userId` read made it the latter.
  const orphanRow = (status: string) => ({
    ...makeRow('orphan-group', { status }),
    organizer: null,
    coOrganizers: [],
    tags: [],
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('still serves a public group, which has no owner to check', async () => {
    prisma.group.findFirst.mockResolvedValue(orphanRow('PUBLISHED'))

    await expect(groupRepository.findBySlug('orphan-group')).resolves.toMatchObject({
      status: 'PUBLISHED',
      organizer: null,
    })
  })

  it('treats every viewer as a stranger, so a non-public orphan stays hidden', async () => {
    prisma.group.findFirst.mockResolvedValue(orphanRow('DRAFT'))

    await expect(
      groupRepository.findBySlug('orphan-group', { userId: 'owner-1', role: 'ORGANIZER' }),
    ).resolves.toBeNull()
  })

  it('still reaches an admin, who is the one who has to clean the row up', async () => {
    prisma.group.findFirst.mockResolvedValue(orphanRow('DRAFT'))

    await expect(
      groupRepository.findBySlug('orphan-group', { userId: 'admin-1', role: 'ADMIN' }),
    ).resolves.toMatchObject({ status: 'DRAFT', organizer: null })
  })
})
