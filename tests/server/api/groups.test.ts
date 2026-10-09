import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createEvent } from 'h3'

vi.mock('~~/server/services/groupService', () => ({
  groupService: {
    getPublishedGroups: vi.fn(),
    updateGroup: vi.fn(),
    deleteGroup: vi.fn(),
  },
}))

vi.mock('~~/server/utils/auth', () => ({
  requireAuth: vi.fn(),
}))

vi.mock('~~/server/utils/rateLimit', () => ({
  useRateLimiter: vi.fn(),
  authLimiter: {},
  registerLimiter: {},
  applicationLimiter: {},
  globalLimiter: {},
  uploadLimiter: {},
  getClientIP: vi.fn().mockReturnValue('127.0.0.1'),
}))

vi.mock('~~/server/utils/prisma', () => ({ prisma: globalThis.prisma }))

// eslint-disable-next-line import/first -- import must follow vi.mock()
import { groupService } from '~~/server/services/groupService'
// eslint-disable-next-line import/first -- import must follow vi.mock()
import { requireAuth } from '~~/server/utils/auth'
// eslint-disable-next-line import/first -- import must follow vi.mock()
import { ForbiddenError, HasApplicationsError, NotFoundError } from '~~/server/utils/domainErrors'

const mockGetPublishedGroups = vi.mocked(groupService.getPublishedGroups)
const mockUpdateGroup = vi.mocked(groupService.updateGroup)
const mockDeleteGroup = vi.mocked(groupService.deleteGroup)
const mockRequireAuth = vi.mocked(requireAuth)

function makeGetEvent(url: string) {
  return createEvent({ url, method: 'GET' }, {})
}

function makePostEvent(url: string, body: unknown) {
  const event = createEvent({ url, method: 'POST', headers: { 'content-type': 'application/json' } }, {})
  event._requestBody = JSON.stringify(body)
  return event
}

function makePatchEvent(url: string, body: unknown) {
  const event = createEvent({ url, method: 'PATCH', headers: { 'content-type': 'application/json' } }, {})
  event._requestBody = JSON.stringify(body)
  return event
}

function setRouterParams(event: ReturnType<typeof makeGetEvent>, params: Record<string, string>) {
  event.context.params = { ...event.context.params, ...params }
}

/**
 * Shaped like a repository list row: the handler pipes it through `mapGroupCard`, so the
 * fields the mapper reads have to be present. The cuids and `organizerId` are here on
 * purpose — the point of the test is that they do not come back out.
 */
function makeListRow(slug: string, title: string) {
  return {
    id: `cuid-${slug}`,
    slug,
    title,
    description: 'Body text that a card never renders',
    type: 'THERAPEUTIC',
    format: 'ONLINE',
    location: null,
    startsAt: new Date('2026-11-01T10:00:00Z'),
    endsAt: new Date('2026-12-01T10:00:00Z'),
    capacity: 12,
    priceAmount: '1500.00',
    currency: 'UAH',
    status: 'PUBLISHED',
    timezone: 'Europe/Kyiv',
    rejectionReason: null,
    organizerId: 'cuid-organizer',
    organizer: {
      id: 'cuid-organizer',
      userId: 'cuid-user',
      slug: 'organizer-slug',
      firstName: 'Олена',
      lastName: 'Коваль',
      avatarUrl: null,
    },
    coOrganizers: [],
    tags: [{ id: 'cuid-tag', name: 'Тривожність', slug: 'tryvozhnist' }],
  }
}

const publishedGroups = [
  makeListRow('group-1', 'Published Group'),
  makeListRow('group-2', 'Another Group'),
]

describe('GET /api/groups', () => {
  let handler: (_event: ReturnType<typeof makeGetEvent>) => Promise<unknown>

  beforeEach(async () => {
    vi.clearAllMocks()

    mockGetPublishedGroups.mockResolvedValue({
      groups: publishedGroups,
      total: 2,
    })

    const mod = await import('../../../server/api/groups.get')
    handler = mod.default as unknown as (_event: ReturnType<typeof makeGetEvent>) => Promise<unknown>
  })

  it('returns published groups without authentication', async () => {
    const result = await handler(makeGetEvent('/api/groups')) as {
      groups: Array<Record<string, unknown>>
      total: number
      page: number
    }

    expect(result.total).toBe(2)
    expect(result.page).toBe(1)
    expect(result.groups).toHaveLength(2)
    expect(result.groups[0]).toMatchObject({
      slug: 'group-1',
      title: 'Published Group',
      status: 'PUBLISHED',
      // The public identifier is the slug, not the cuid.
      id: 'group-1',
      // Decimal reaches JSON as a string; the client type has always said number.
      priceAmount: 1500,
      organizer: { firstName: 'Олена', lastName: 'Коваль' },
    })
    expect(mockRequireAuth).not.toHaveBeenCalled()
  })

  it('strips every internal identifier from the list payload', async () => {
    const result = await handler(makeGetEvent('/api/groups')) as {
      groups: Array<Record<string, unknown>>
    }

    for (const group of result.groups) {
      expect(group).not.toHaveProperty('organizerId')
      expect(group).not.toHaveProperty('timezone')
      expect(group).not.toHaveProperty('rejectionReason')
      expect(group).not.toHaveProperty('description')
      expect(group).not.toHaveProperty('tags')
      expect(group.organizer).not.toHaveProperty('userId')
      expect(group.organizer).not.toHaveProperty('id')
      expect(group.id).not.toMatch(/^cuid-/)
    }

    // The cuids the repository returned must not survive anywhere in the serialized body.
    expect(JSON.stringify(result)).not.toContain('cuid-')
  })

  it('returns 400 for invalid page parameter', async () => {
    try {
      await handler(makeGetEvent('/api/groups?page=-1'))
      expect.unreachable('should have thrown')
    }
    catch (error) {
      const err = error as { statusCode: number, data?: { code?: string } }
      expect(err.statusCode).toBe(400)
      expect(err.data?.code).toBe('VALIDATION_FAILED')
    }
  })

  it('returns 400 for limit exceeding maximum', async () => {
    try {
      await handler(makeGetEvent('/api/groups?limit=999'))
      expect.unreachable('should have thrown')
    }
    catch (error) {
      const err = error as { statusCode: number }
      expect(err.statusCode).toBe(400)
    }
  })

  it('passes pagination params to service', async () => {
    await handler(makeGetEvent('/api/groups?page=2&limit=10'))

    expect(mockGetPublishedGroups).toHaveBeenCalledWith(
      expect.any(Object),
      { skip: 10, take: 10 },
    )
  })
})

describe('PATCH /api/groups/[slug]', () => {
  let handler: (_event: ReturnType<typeof makePatchEvent>) => Promise<unknown>

  beforeEach(async () => {
    vi.clearAllMocks()

    const mod = await import('../../../server/api/groups/[slug].patch')
    handler = mod.default as unknown as (_event: ReturnType<typeof makePatchEvent>) => Promise<unknown>
  })

  it('returns 401 when not authenticated', async () => {
    mockRequireAuth.mockRejectedValue(Object.assign(new Error('Unauthorized'), { statusCode: 401 }))

    const event = makePatchEvent('/api/groups/test-slug', { title: 'Updated' })
    setRouterParams(event, { slug: 'test-slug' })

    await expect(handler(event)).rejects.toMatchObject({ statusCode: 401 })
  })

  it('returns 403 when non-owner tries to update', async () => {
    mockRequireAuth.mockResolvedValue({
      id: 'user-other',
      role: 'ORGANIZER',
    } as Parameters<typeof mockRequireAuth>[0] extends Promise<infer U> ? U : never)

    mockUpdateGroup.mockRejectedValue(Object.assign(new Error('Forbidden'), { statusCode: 403 }))

    const event = makePatchEvent('/api/groups/test-slug', { title: 'Hacked' })
    setRouterParams(event, { slug: 'test-slug' })

    await expect(handler(event)).rejects.toMatchObject({ statusCode: 403 })
  })

  it('returns 400 when slug is missing', async () => {
    mockRequireAuth.mockResolvedValue({
      id: 'user-1',
      role: 'ORGANIZER',
    } as Parameters<typeof mockRequireAuth>[0] extends Promise<infer U> ? U : never)

    const event = makePatchEvent('/api/groups/', { title: 'Updated' })

    await expect(handler(event)).rejects.toMatchObject({ statusCode: 400 })
  })

  it('delegates to groupService.updateGroup with correct context', async () => {
    mockRequireAuth.mockResolvedValue({
      id: 'user-1',
      role: 'ORGANIZER',
    } as Parameters<typeof mockRequireAuth>[0] extends Promise<infer U> ? U : never)

    mockUpdateGroup.mockResolvedValue({ success: true })

    const event = makePatchEvent('/api/groups/test-slug', { title: 'Updated Title' })
    setRouterParams(event, { slug: 'test-slug' })

    await handler(event)

    expect(mockUpdateGroup).toHaveBeenCalledWith(
      'test-slug',
      { title: 'Updated Title' },
      expect.objectContaining({
        userId: 'user-1',
        role: 'ORGANIZER',
      }),
    )
  })
})

describe('DELETE /api/groups/[slug]', () => {
  let handler: (_event: ReturnType<typeof makePostEvent>) => Promise<unknown>

  beforeEach(async () => {
    vi.clearAllMocks()

    const mod = await import('../../../server/api/groups/[slug].delete')
    handler = mod.default as unknown as (_event: ReturnType<typeof makePostEvent>) => Promise<unknown>
  })

  function asUser(id: string, role: string) {
    mockRequireAuth.mockResolvedValue({
      id,
      role,
    } as Parameters<typeof mockRequireAuth>[0] extends Promise<infer U> ? U : never)
  }

  it('returns 401 when not authenticated', async () => {
    mockRequireAuth.mockRejectedValue(Object.assign(new Error('Unauthorized'), { statusCode: 401 }))

    const event = makePostEvent('/api/groups/test-slug', {})
    setRouterParams(event, { slug: 'test-slug' })

    await expect(handler(event)).rejects.toMatchObject({ statusCode: 401 })
  })

  it('returns 400 when slug is missing', async () => {
    asUser('user-1', 'ORGANIZER')

    await expect(handler(makePostEvent('/api/groups/', {}))).rejects.toMatchObject({
      statusCode: 400,
    })
    expect(mockDeleteGroup).not.toHaveBeenCalled()
  })

  it('delegates to groupService.deleteGroup with the viewer context', async () => {
    asUser('user-1', 'ORGANIZER')
    mockDeleteGroup.mockResolvedValue({ success: true })

    const event = makePostEvent('/api/groups/test-slug', {})
    setRouterParams(event, { slug: 'test-slug' })

    const result = await handler(event) as { success: boolean }

    expect(result.success).toBe(true)
    expect(mockDeleteGroup).toHaveBeenCalledWith('test-slug', {
      userId: 'user-1',
      role: 'ORGANIZER',
    })
  })

  it('passes an admin through with the ADMIN role', async () => {
    asUser('admin-1', 'ADMIN')
    mockDeleteGroup.mockResolvedValue({ success: true })

    const event = makePostEvent('/api/groups/test-slug', {})
    setRouterParams(event, { slug: 'test-slug' })

    await handler(event)

    expect(mockDeleteGroup).toHaveBeenCalledWith('test-slug', {
      userId: 'admin-1',
      role: 'ADMIN',
    })
  })

  // The service owns these rules; the handler's job is not to flatten their codes into a
  // generic 500 on the way out.
  it.each([
    ['ForbiddenError', new ForbiddenError(), 403, 'FORBIDDEN'],
    ['NotFoundError', new NotFoundError('Group not found'), 404, 'NOT_FOUND'],
    ['HasApplicationsError', new HasApplicationsError(), 409, 'HAS_APPLICATIONS'],
  ])('maps %s to its own status and code', async (_name, error, statusCode, code) => {
    asUser('user-1', 'ORGANIZER')
    mockDeleteGroup.mockRejectedValue(error)

    const event = makePostEvent('/api/groups/test-slug', {})
    setRouterParams(event, { slug: 'test-slug' })

    await expect(handler(event)).rejects.toMatchObject({
      statusCode,
      data: { code },
    })
  })

  it('sanitizes an unknown failure to 500 INTERNAL', async () => {
    asUser('user-1', 'ORGANIZER')
    mockDeleteGroup.mockRejectedValue(new Error('boom'))

    const event = makePostEvent('/api/groups/test-slug', {})
    setRouterParams(event, { slug: 'test-slug' })

    await expect(handler(event)).rejects.toMatchObject({
      statusCode: 500,
      data: { code: 'INTERNAL' },
    })
  })
})
