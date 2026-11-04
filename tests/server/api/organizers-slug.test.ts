import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createEvent } from 'h3'

vi.mock('~~/server/utils/prisma', () => ({ prisma: globalThis.prisma }))

vi.mock('~~/server/utils/auth', () => ({
  requireAuth: vi.fn(),
  getUser: vi.fn(),
}))

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- globalThis.prisma is set in test setup
const prisma = globalThis.prisma as any

// eslint-disable-next-line import/first -- import must follow vi.mock()
import { getUser } from '~~/server/utils/auth'

const mockGetUser = vi.mocked(getUser)

function makeGetEvent(slug: string) {
  const event = createEvent({ url: `/api/organizers/${slug}`, method: 'GET', headers: {} }, {})
  event.context.params = { slug }
  return event
}

function storedProfile(overrides: Record<string, unknown> = {}) {
  return {
    id: 'profile-1',
    slug: 'olena-kovalenko',
    firstName: 'Олена',
    lastName: 'Коваленко',
    avatarUrl: null,
    bio: 'Клінічний психолог.',
    qualification: 'Магістр психології',
    experienceYears: 10,
    languages: ['uk'],
    workFormats: ['ONLINE'],
    city: 'Київ',
    education: ['КНУ ім. Шевченка'],
    professionalOrganization: 'Українська спілка психотерапевтів',
    professionalOrganizationStatus: 'Дійсний член',
    telegramUrl: null,
    instagramUrl: null,
    linkedinUrl: null,
    whatsappUrl: null,
    facebookUrl: null,
    youtubeUrl: null,
    verificationStatus: 'VERIFIED',
    specializations: ['Тривожні розлади'],
    groups: [],
    ...overrides,
  }
}

async function callHandler(slug: string) {
  const mod = await import('../../../server/api/organizers/[slug].get')
  const handler = mod.default as unknown as (_event: unknown) => Promise<Record<string, unknown>>
  return handler(makeGetEvent(slug))
}

describe('GET /api/organizers/[slug]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue(null)
  })

  it('returns verificationStatus in the body for a VERIFIED profile', async () => {
    prisma.organizerProfile.findFirst.mockResolvedValue(storedProfile())

    const body = await callHandler('olena-kovalenko')

    expect(body.verificationStatus).toBe('VERIFIED')
  })

  it('returns the fields the public template renders', async () => {
    prisma.organizerProfile.findFirst.mockResolvedValue(storedProfile())

    const body = await callHandler('olena-kovalenko')

    expect(body).toMatchObject({
      slug: 'olena-kovalenko',
      professionalOrganization: 'Українська спілка психотерапевтів',
      professionalOrganizationStatus: 'Дійсний член',
      education: ['КНУ ім. Шевченка'],
      verificationStatus: 'VERIFIED',
    })
    expect(body).not.toHaveProperty('userId')
    expect(body).not.toHaveProperty('rejectionReason')
  })

  it('answers 404 for a non-verified profile requested anonymously', async () => {
    prisma.organizerProfile.findFirst.mockResolvedValue(storedProfile({ verificationStatus: 'PENDING' }))

    await expect(callHandler('olena-kovalenko')).rejects.toMatchObject({
      statusCode: 404,
      data: { code: 'NOT_FOUND' },
    })
  })

  it('exposes a non-verified profile to an admin', async () => {
    prisma.organizerProfile.findFirst.mockResolvedValue(storedProfile({ verificationStatus: 'PENDING' }))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- a partial User is enough for the gate
    mockGetUser.mockResolvedValue({ id: 'admin-1', role: 'ADMIN' } as any)

    const body = await callHandler('olena-kovalenko')

    expect(body.verificationStatus).toBe('PENDING')
  })

  it('answers 404 for a signed-in ORGANIZER', async () => {
    prisma.organizerProfile.findFirst.mockResolvedValue(storedProfile({ verificationStatus: 'PENDING' }))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- a partial User is enough for the gate
    mockGetUser.mockResolvedValue({ id: 'org-1', role: 'ORGANIZER' } as any)

    await expect(callHandler('olena-kovalenko')).rejects.toMatchObject({
      statusCode: 404,
      data: { code: 'NOT_FOUND' },
    })
  })

  /**
   * The resource handed to `can()` carries no owner id on purpose, so `isOwner` cannot fire:
   * the organizer who owns a pending profile is not admitted to its public page and reads it
   * at `/profile` instead. Locking that keeps the handler's "unchanged behaviour" claim true
   * if somebody later widens the resource.
   */
  it('does not admit the owner of a non-verified profile', async () => {
    prisma.organizerProfile.findFirst.mockResolvedValue(
      storedProfile({ verificationStatus: 'REJECTED', userId: 'owner-1' }),
    )
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- a partial User is enough for the gate
    mockGetUser.mockResolvedValue({ id: 'owner-1', role: 'ORGANIZER' } as any)

    await expect(callHandler('olena-kovalenko')).rejects.toMatchObject({
      statusCode: 404,
      data: { code: 'NOT_FOUND' },
    })
  })

  // A VERIFIED profile is public by definition, so the session is never resolved for one —
  // a GoTrue round-trip plus a `User` query on the hottest read on the site would buy
  // nothing but a `true` the verification status already settled.
  it('does not resolve a session for a VERIFIED profile', async () => {
    prisma.organizerProfile.findFirst.mockResolvedValue(storedProfile())

    await expect(callHandler('olena-kovalenko')).resolves.toBeDefined()
    expect(mockGetUser).not.toHaveBeenCalled()
  })

  /**
   * Models a stored profile whose user is deactivated: a query carrying the
   * `user.isActive` filter matches nothing, a query without it returns the row.
   *
   * Driving the mock from the where clause rather than hardcoding `null` is the point —
   * delete the filter from `findBySlugWithGroups` and the handler starts serving a
   * VERIFIED profile for a banned organizer, which is what these two tests exist to catch.
   */
  function givenABlockedOrganizer(profile: Record<string, unknown>) {
    prisma.organizerProfile.findFirst.mockImplementation(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- partial Prisma args
      ({ where }: any) => (where?.user?.isActive === true ? Promise.resolve(null) : Promise.resolve(profile)),
    )
  }

  it('answers 404 for a deactivated VERIFIED organizer', async () => {
    givenABlockedOrganizer(storedProfile())

    await expect(callHandler('olena-kovalenko')).rejects.toMatchObject({
      statusCode: 404,
      data: { code: 'NOT_FOUND' },
    })
  })

  it('answers 404 for a deactivated VERIFIED organizer to an admin too', async () => {
    givenABlockedOrganizer(storedProfile())
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- a partial User is enough for the gate
    mockGetUser.mockResolvedValue({ id: 'admin-1', role: 'ADMIN' } as any)

    await expect(callHandler('olena-kovalenko')).rejects.toMatchObject({
      statusCode: 404,
      data: { code: 'NOT_FOUND' },
    })
  })
})
