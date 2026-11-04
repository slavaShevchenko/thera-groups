import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createEvent } from 'h3'

vi.mock('~~/server/utils/prisma', () => ({ prisma: globalThis.prisma }))

vi.mock('~~/server/utils/auth', () => ({
  getUser: vi.fn(),
}))

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- globalThis.prisma is set in test setup
const prisma = globalThis.prisma as any

// eslint-disable-next-line import/first -- import must follow vi.mock()
import { getUser } from '~~/server/utils/auth'

const mockGetUser = vi.mocked(getUser)

const PROFILE_ID = 'cmubxoh4r000bhixv7cqilts1'

function makeGetEvent(url = '/api/organizers') {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- the test only needs h3's event shape
  return createEvent({ url, method: 'GET', headers: {} }, {} as any)
}

async function callHandler(url = '/api/organizers') {
  const mod = await import('../../../server/api/organizers/index.get')
  const handler = mod.default as unknown as (_event: unknown) => Promise<{
    organizers: Record<string, unknown>[]
    total: number
  }>
  return handler(makeGetEvent(url))
}

describe('GET /api/organizers', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    mockGetUser.mockResolvedValue(null)
    prisma.organizerProfile.findMany.mockResolvedValue([
      {
        id: PROFILE_ID,
        firstName: 'Олена',
        lastName: 'Коваленко',
        slug: 'olena-kovalenko',
        avatarUrl: null,
        city: 'Київ',
        experienceYears: 8,
        specializations: ['Гештальт'],
        _count: { groups: 2 },
      },
    ])
    prisma.organizerProfile.count.mockResolvedValue(1)
  })

  // The catalog is public, and the profile cuid is the value `POST /api/groups` accepts as
  // `organizerId`. Handing it to an anonymous visitor gives them an identifier they can do
  // nothing with, in the same way `organizers/[slug].get.ts` already declined to.
  it('omits the profile id from an anonymous response', async () => {
    const { organizers } = await callHandler()

    expect(organizers[0]).not.toHaveProperty('id')
    expect(JSON.stringify(organizers)).not.toContain(PROFILE_ID)
  })

  it('still identifies every organizer by slug, which is what the catalog links with', async () => {
    const { organizers } = await callHandler()

    expect(organizers[0]).toEqual({
      firstName: 'Олена',
      lastName: 'Коваленко',
      slug: 'olena-kovalenko',
      avatarUrl: null,
      city: 'Київ',
      experienceYears: 8,
      specializations: ['Гештальт'],
      groupsCount: 2,
    })
  })

  // The admin "create a group on behalf of" picker reads the cuid from this endpoint, so
  // hiding it unconditionally would break that flow rather than close a leak.
  it('includes the profile id for an ADMIN', async () => {
    mockGetUser.mockResolvedValue({ id: 'admin-1', role: 'ADMIN', email: 'admin@example.com' })

    const { organizers } = await callHandler()

    expect(organizers[0]?.id).toBe(PROFILE_ID)
  })

  // An ORGANIZER cannot create on somebody else's behalf either, so the cuid is no more
  // useful to them than to an anonymous visitor.
  it.each(['ORGANIZER', 'VISITOR'])('omits the profile id for a signed-in %s', async (role) => {
    mockGetUser.mockResolvedValue({ id: 'u-1', role, email: 'u@example.com' })

    const { organizers } = await callHandler()

    expect(organizers[0]).not.toHaveProperty('id')
  })

  it('stays reachable with no session at all', async () => {
    mockGetUser.mockResolvedValue(null)

    await expect(callHandler()).resolves.toMatchObject({ total: 1, page: 1 })
  })

  it('rejects an out-of-range page', async () => {
    await expect(callHandler('/api/organizers?page=0')).rejects.toMatchObject({
      statusCode: 400,
      data: { code: 'VALIDATION_FAILED' },
    })
    expect(prisma.organizerProfile.findMany).not.toHaveBeenCalled()
  })
})
