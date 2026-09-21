import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createEvent } from 'h3'

vi.mock('~~/server/services/groupService', () => ({
  groupService: {
    getPublishedGroups: vi.fn(),
    updateGroup: vi.fn(),
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- globalThis.prisma is set in test setup
const prisma = globalThis.prisma as any

// eslint-disable-next-line import/first -- import must follow vi.mock()
import { groupService } from '~~/server/services/groupService'
// eslint-disable-next-line import/first -- import must follow vi.mock()
import { requireAuth } from '~~/server/utils/auth'

const mockGetPublishedGroups = vi.mocked(groupService.getPublishedGroups)
const mockUpdateGroup = vi.mocked(groupService.updateGroup)
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

const publishedGroups = [
  { id: 'g-1', slug: 'group-1', title: 'Published Group', status: 'PUBLISHED' },
  { id: 'g-2', slug: 'group-2', title: 'Another Group', status: 'PUBLISHED' },
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
      groups: unknown[]
      total: number
      page: number
    }

    expect(result.groups).toEqual(publishedGroups)
    expect(result.total).toBe(2)
    expect(result.page).toBe(1)
    expect(mockRequireAuth).not.toHaveBeenCalled()
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

  it('returns 401 when not authenticated', async () => {
    mockRequireAuth.mockRejectedValue(Object.assign(new Error('Unauthorized'), { statusCode: 401 }))

    const event = makePostEvent('/api/groups/test-slug', {})
    setRouterParams(event, { slug: 'test-slug' })

    await expect(handler(event)).rejects.toMatchObject({ statusCode: 401 })
  })

  it('deletes draft group when user is owner', async () => {
    mockRequireAuth.mockResolvedValue({
      id: 'user-1',
      role: 'ORGANIZER',
    } as Parameters<typeof mockRequireAuth>[0] extends Promise<infer U> ? U : never)

    prisma.group.findUnique.mockResolvedValue({
      id: 'group-1',
      slug: 'test-slug',
      status: 'DRAFT',
      organizer: { userId: 'user-1' },
    })

    prisma.group.delete.mockResolvedValue({ id: 'group-1' })

    const event = makePostEvent('/api/groups/test-slug', {})
    setRouterParams(event, { slug: 'test-slug' })

    const result = await handler(event) as { success: boolean }

    expect(result.success).toBe(true)
    expect(prisma.group.delete).toHaveBeenCalledWith({ where: { id: 'group-1' } })
  })

  it('returns 403 when user is not the owner', async () => {
    mockRequireAuth.mockResolvedValue({
      id: 'user-other',
      role: 'ORGANIZER',
    } as Parameters<typeof mockRequireAuth>[0] extends Promise<infer U> ? U : never)

    prisma.group.findUnique.mockResolvedValue({
      id: 'group-1',
      slug: 'test-slug',
      status: 'DRAFT',
      organizer: { userId: 'user-1' },
    })

    const event = makePostEvent('/api/groups/test-slug', {})
    setRouterParams(event, { slug: 'test-slug' })

    await expect(handler(event)).rejects.toMatchObject({ statusCode: 403 })
  })

  it('returns 403 when group is not DRAFT or REJECTED', async () => {
    mockRequireAuth.mockResolvedValue({
      id: 'user-1',
      role: 'ORGANIZER',
    } as Parameters<typeof mockRequireAuth>[0] extends Promise<infer U> ? U : never)

    prisma.group.findUnique.mockResolvedValue({
      id: 'group-1',
      slug: 'test-slug',
      status: 'PUBLISHED',
      organizer: { userId: 'user-1' },
    })

    const event = makePostEvent('/api/groups/test-slug', {})
    setRouterParams(event, { slug: 'test-slug' })

    await expect(handler(event)).rejects.toMatchObject({ statusCode: 403 })
  })

  it('allows admin to delete any draft group', async () => {
    mockRequireAuth.mockResolvedValue({
      id: 'admin-1',
      role: 'ADMIN',
    } as Parameters<typeof mockRequireAuth>[0] extends Promise<infer U> ? U : never)

    prisma.group.findUnique.mockResolvedValue({
      id: 'group-1',
      slug: 'test-slug',
      status: 'DRAFT',
      organizer: { userId: 'user-1' },
    })

    prisma.group.delete.mockResolvedValue({ id: 'group-1' })

    const event = makePostEvent('/api/groups/test-slug', {})
    setRouterParams(event, { slug: 'test-slug' })

    const result = await handler(event) as { success: boolean }

    expect(result.success).toBe(true)
  })
})
