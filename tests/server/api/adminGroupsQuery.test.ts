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
