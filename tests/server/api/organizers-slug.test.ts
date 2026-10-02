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
    prisma.organizerProfile.findUnique.mockResolvedValue(storedProfile())

    const body = await callHandler('olena-kovalenko')

    expect(body.verificationStatus).toBe('VERIFIED')
  })

  it('returns the fields the public template renders', async () => {
    prisma.organizerProfile.findUnique.mockResolvedValue(storedProfile())

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
    prisma.organizerProfile.findUnique.mockResolvedValue(storedProfile({ verificationStatus: 'PENDING' }))

    await expect(callHandler('olena-kovalenko')).rejects.toMatchObject({
      statusCode: 404,
      data: { code: 'NOT_FOUND' },
    })
  })

  it('exposes a non-verified profile to an admin', async () => {
    prisma.organizerProfile.findUnique.mockResolvedValue(storedProfile({ verificationStatus: 'PENDING' }))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- a partial User is enough for the gate
    mockGetUser.mockResolvedValue({ id: 'admin-1', role: 'ADMIN' } as any)

    const body = await callHandler('olena-kovalenko')

    expect(body.verificationStatus).toBe('PENDING')
  })
})
