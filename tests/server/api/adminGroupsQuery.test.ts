import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createEvent } from 'h3'

vi.mock('~~/server/utils/auth', () => ({ requireAuth: vi.fn() }))
vi.mock('~~/server/utils/permissions', () => ({ requirePermission: vi.fn() }))
vi.mock('../../../server/repositories/groupRepository', () => ({
  groupRepository: { findAllAdmin: vi.fn() },
}))

// eslint-disable-next-line import/first -- imports must follow vi.mock()
import { requireAuth } from '~~/server/utils/auth'
// eslint-disable-next-line import/first -- imports must follow vi.mock()
import { groupRepository } from '../../../server/repositories/groupRepository'
// eslint-disable-next-line import/first -- imports must follow vi.mock()
import { adminGroupsQuerySchema } from '../../../server/validators/query'
// eslint-disable-next-line import/first -- imports must follow vi.mock()
import groupsHandler from '../../../server/api/admin/groups.get'

const ADMIN = { id: 'admin-1', role: 'ADMIN', email: 'admin@example.com', isActive: true }

describe('adminGroupsQuerySchema — status', () => {
  it('reads a single status as a list of one, so existing callers are unaffected', () => {
    expect(adminGroupsQuerySchema.parse({ status: 'PUBLISHED' }).status).toEqual(['PUBLISHED'])
  })

  it('reads the statuses of a view as a comma-separated list', () => {
    expect(adminGroupsQuerySchema.parse({ status: 'PUBLISHED,FULL' }).status)
      .toEqual(['PUBLISHED', 'FULL'])
  })

  it('trims the spaces a hand-written query string may carry', () => {
    expect(adminGroupsQuerySchema.parse({ status: ' PUBLISHED , FULL ' }).status)
      .toEqual(['PUBLISHED', 'FULL'])
  })

  it('leaves status undefined when the query omits it', () => {
    expect(adminGroupsQuerySchema.parse({}).status).toBeUndefined()
  })

  it('rejects a list holding a value that is not a status', () => {
    expect(adminGroupsQuerySchema.safeParse({ status: 'PUBLISHED,NOPE' }).success).toBe(false)
  })

  it('rejects a list with nothing in it', () => {
    expect(adminGroupsQuerySchema.safeParse({ status: ',' }).success).toBe(false)
  })
})

describe('GET /api/admin/groups — status filter', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireAuth).mockResolvedValue(ADMIN as never)
    vi.mocked(groupRepository.findAllAdmin).mockResolvedValue({ groups: [], total: 0 } as never)
  })

  async function call(url: string) {
    const event = createEvent({ url, method: 'GET', headers: {} }, {})
    await (groupsHandler as unknown as (_event: unknown) => Promise<unknown>)(event)

    return vi.mocked(groupRepository.findAllAdmin).mock.calls[0][0]
  }

  it('asks for every status in the view, which is how a FULL group became reachable', async () => {
    const options = await call('/api/admin/groups?status=PUBLISHED,FULL')

    expect(options.where).toEqual({ status: { in: ['PUBLISHED', 'FULL'] } })
  })

  it('filters on nothing when the query names no status', async () => {
    const options = await call('/api/admin/groups')

    expect(options.where).toEqual({})
  })

  it('answers 400 for a status that does not exist', async () => {
    await expect(call('/api/admin/groups?status=NOPE')).rejects.toMatchObject({ statusCode: 400 })
  })
})

describe('GET /api/admin/groups — a group whose organizer is gone', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireAuth).mockResolvedValue(ADMIN as never)
  })

  function adminRow(overrides: Record<string, unknown> = {}) {
    return {
      id: 'group-1',
      slug: 'kept',
      title: 'Kept group',
      status: 'PUBLISHED',
      type: 'SUPPORT',
      format: 'ONLINE',
      startsAt: new Date('2026-12-01T10:00:00.000Z'),
      rejectionReason: null,
      organizer: {
        id: 'profile-1',
        firstName: 'Олена',
        lastName: 'Коваленко',
        slug: 'olena-kovalenko',
        avatarUrl: null,
      },
      coOrganizers: [],
      createdAt: new Date('2026-10-01T10:00:00.000Z'),
      updatedAt: new Date('2026-10-02T10:00:00.000Z'),
      ...overrides,
    }
  }

  async function callWith(groups: unknown[]) {
    vi.mocked(groupRepository.findAllAdmin)
      .mockResolvedValue({ groups, total: groups.length } as never)

    const event = createEvent({ url: '/api/admin/groups', method: 'GET', headers: {} }, {})
    return (groupsHandler as unknown as (_event: unknown) => Promise<{ items: unknown[] }>)(event)
  }

  // `organizerId` is nullable with an `ON DELETE SET NULL` foreign key. The four reads this
  // handler makes off `organizer` were non-null assertions, so the first organizer-less row
  // would have answered 500 for the whole page instead of listing the rows that are fine.
  it('drops the organizer-less row and keeps the rest', async () => {
    const orphan = adminRow({ id: 'group-2', slug: 'orphan', organizer: null })

    const { items } = await callWith([adminRow(), orphan])

    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({ slug: 'kept', organizer: { slug: 'olena-kovalenko' } })
  })

  it('answers an empty list rather than a 500 when every row is an orphan', async () => {
    const { items } = await callWith([
      adminRow({ id: 'a', organizer: null }),
      adminRow({ id: 'b', organizer: null }),
    ])

    expect(items).toEqual([])
  })
})
