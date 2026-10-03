import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createEvent } from 'h3'

vi.mock('~~/server/utils/prisma', () => ({ prisma: globalThis.prisma }))

vi.mock('~~/server/utils/auth', () => ({
  requireAuth: vi.fn(),
}))

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- globalThis.prisma is set in test setup
const prisma = globalThis.prisma as any

// eslint-disable-next-line import/first -- import must follow vi.mock()
import { requireAuth } from '~~/server/utils/auth'

const mockRequireAuth = vi.mocked(requireAuth)

function makeGetEvent(url: string) {
  return createEvent({ url, method: 'GET', headers: {} }, {})
}

// Real User.id values are 25-char cuids (Prisma @default(cuid())).
function cuid(index: number): string {
  return `cmubxoh4r000bhixv7cqilts${index}`.slice(0, 25)
}

function searchUrl(excludeIds: string[], q = 'Олена'): string {
  const params = new URLSearchParams({ q })
  if (excludeIds.length > 0) params.set('exclude', excludeIds.join(','))
  return `/api/organizers/search?${params.toString()}`
}

async function callHandler(url: string) {
  const mod = await import('../../../server/api/organizers/search.get')
  const handler = mod.default as unknown as (_event: unknown) => Promise<unknown>
  return handler(makeGetEvent(url))
}

function notInArg(): string[] | undefined {
  const arg = prisma.user.findMany.mock.calls[0][0]
  return arg.where.id?.notIn
}

describe('GET /api/organizers/search', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRequireAuth.mockResolvedValue({ id: 'me', role: 'ORGANIZER', email: 'me@example.com' })
    prisma.user.findMany.mockResolvedValue([
      {
        id: cuid(7),
        organizerProfile: {
          firstName: 'Олена',
          lastName: 'Коваленко',
          avatarUrl: null,
          slug: 'olena-kovalenko',
        },
      },
    ])
  })

  it('accepts the exclude list built for 2 co-organizers (owner + current user included)', async () => {
    // CoOrganizersPicker sends picked co-organizers + ownerId + currentUserId.
    // 4 x 25-char cuids + 3 commas = 103 chars, which the old .max(100) rejected
    // with 400 VALIDATION_FAILED "Invalid query parameters".
    const excludeIds = [cuid(1), cuid(2), cuid(3), cuid(4)]

    await expect(callHandler(searchUrl(excludeIds))).resolves.toEqual([
      {
        id: cuid(7),
        firstName: 'Олена',
        lastName: 'Коваленко',
        avatarUrl: null,
        slug: 'olena-kovalenko',
      },
    ])
    expect(notInArg()).toEqual(excludeIds)
  })

  it('accepts the realistic maximum list (10 co-organizers + owner + current user)', async () => {
    const excludeIds = Array.from({ length: 12 }, (_, i) => cuid(i))

    await expect(callHandler(searchUrl(excludeIds))).resolves.toBeDefined()
    expect(notInArg()).toEqual(excludeIds)
  })

  it('omits the id filter when exclude is absent', async () => {
    await expect(callHandler(searchUrl([]))).resolves.toBeDefined()
    expect(notInArg()).toBeUndefined()
  })

  it('omits the id filter when exclude is an empty string', async () => {
    await expect(callHandler('/api/organizers/search?q=%D0%9E%D0%BB%D0%B5%D0%BD%D0%B0&exclude='))
      .resolves.toBeDefined()
    expect(notInArg()).toBeUndefined()
  })

  it('rejects a query shorter than 2 characters', async () => {
    await expect(callHandler('/api/organizers/search?q=%D0%9E')).rejects.toMatchObject({
      statusCode: 400,
      data: { code: 'VALIDATION_FAILED' },
    })
    expect(prisma.user.findMany).not.toHaveBeenCalled()
  })

  it('rejects an exclude id longer than 50 characters', async () => {
    await expect(callHandler(searchUrl(['a'.repeat(51)]))).rejects.toMatchObject({
      statusCode: 400,
      data: { code: 'VALIDATION_FAILED' },
    })
    expect(prisma.user.findMany).not.toHaveBeenCalled()
  })

  it('forbids a VISITOR', async () => {
    mockRequireAuth.mockResolvedValue({ id: 'v', role: 'VISITOR', email: 'v@example.com' })

    await expect(callHandler(searchUrl([]))).rejects.toMatchObject({
      statusCode: 403,
      data: { code: 'FORBIDDEN' },
    })
  })
})
