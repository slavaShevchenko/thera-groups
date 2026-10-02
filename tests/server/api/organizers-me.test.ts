import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createEvent } from 'h3'
import { PROFILE_LIMITS } from '../../../shared/constants/limits'

vi.mock('~~/server/utils/prisma', () => ({ prisma: globalThis.prisma }))

vi.mock('~~/server/utils/auth', () => ({
  requireAuth: vi.fn(),
  getUser: vi.fn(),
}))

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- globalThis.prisma is set in test setup
const prisma = globalThis.prisma as any

// eslint-disable-next-line import/first -- import must follow vi.mock()
import { requireAuth } from '~~/server/utils/auth'

const mockRequireAuth = vi.mocked(requireAuth)

function makePatchEvent(body: unknown) {
  const event = createEvent(
    { url: '/api/organizers/me', method: 'PATCH', headers: { 'content-type': 'application/json' } },
    {},
  )
  event._requestBody = JSON.stringify(body)
  return event
}

function validBody(overrides: Record<string, unknown> = {}) {
  return {
    firstName: 'Олена',
    lastName: 'Коваленко',
    bio: 'Клінічний психолог.',
    qualification: 'Магістр психології',
    experienceYears: 10,
    languages: ['uk'],
    workFormats: ['ONLINE'],
    city: 'Київ',
    education: ['КНУ ім. Шевченка'],
    professionalOrganization: 'Українська спілка психотерапевтів',
    professionalOrganizationStatus: 'Дійсний член',
    telegramUrl: '',
    instagramUrl: '',
    linkedinUrl: '',
    whatsappUrl: '',
    facebookUrl: '',
    youtubeUrl: '',
    specializations: ['Тривожні розлади'],
    ...overrides,
  }
}

async function callHandler(body: unknown) {
  const mod = await import('../../../server/api/organizers/me.patch')
  const handler = mod.default as unknown as (_event: unknown) => Promise<unknown>
  return handler(makePatchEvent(body))
}

describe('PATCH /api/organizers/me', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    mockRequireAuth.mockResolvedValue({
      id: 'user-1',
      email: 'olena@example.com',
      role: 'ORGANIZER',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- partial User is enough for the handler
    } as any)

    prisma.organizerProfile.findUnique.mockResolvedValue({
      id: 'profile-1',
      userId: 'user-1',
      slug: 'olena-kovalenko',
      firstName: 'Олена',
      lastName: 'Коваленко',
    })

    prisma.organizerProfile.update.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
      Promise.resolve({ id: 'profile-1', slug: 'olena-kovalenko', ...data }))
  })

  it('returns 400 with an issue on bio when bio exceeds BIO_MAX', async () => {
    const body = validBody({ bio: 'a'.repeat(PROFILE_LIMITS.BIO_MAX + 1) })

    await expect(callHandler(body)).rejects.toMatchObject({
      statusCode: 400,
      data: {
        code: 'VALIDATION_FAILED',
        issues: expect.arrayContaining([
          expect.objectContaining({ path: 'bio' }),
        ]),
      },
    })

    expect(prisma.organizerProfile.update).not.toHaveBeenCalled()
  })

  it('returns 400 with an issue on qualification when it is empty', async () => {
    await expect(callHandler(validBody({ qualification: '  ' }))).rejects.toMatchObject({
      statusCode: 400,
      data: {
        code: 'VALIDATION_FAILED',
        issues: expect.arrayContaining([
          expect.objectContaining({ path: 'qualification' }),
        ]),
      },
    })
  })

  it('returns 400 with an issue on professionalOrganization when it is empty', async () => {
    await expect(callHandler(validBody({ professionalOrganization: '' }))).rejects.toMatchObject({
      statusCode: 400,
      data: {
        issues: expect.arrayContaining([
          expect.objectContaining({ path: 'professionalOrganization' }),
        ]),
      },
    })
  })

  it('persists the education array without blank entries', async () => {
    const result = await callHandler(validBody({
      education: ['КНУ ім. Шевченка', '   ', 'УПА, магістратура'],
    })) as Record<string, unknown>

    expect(prisma.organizerProfile.update).toHaveBeenCalledWith({
      where: { id: 'profile-1' },
      data: expect.objectContaining({
        education: ['КНУ ім. Шевченка', 'УПА, магістратура'],
        professionalOrganization: 'Українська спілка психотерапевтів',
        professionalOrganizationStatus: 'Дійсний член',
      }),
    })

    expect(result.education).toEqual(['КНУ ім. Шевченка', 'УПА, магістратура'])
    expect(result).not.toHaveProperty('tiktokUrl')
  })

  it('rejects an education entry longer than EDUCATION_MAX', async () => {
    await expect(callHandler(validBody({
      education: ['a'.repeat(PROFILE_LIMITS.EDUCATION_MAX + 1)],
    }))).rejects.toMatchObject({
      statusCode: 400,
      data: {
        issues: expect.arrayContaining([
          expect.objectContaining({ path: 'education.0' }),
        ]),
      },
    })
  })

  it('leaves the stored education untouched when the field is omitted', async () => {
    const body = validBody()
    delete (body as Record<string, unknown>).education

    await callHandler(body)

    const updateArg = prisma.organizerProfile.update.mock.calls[0][0]
    expect(updateArg.data).not.toHaveProperty('education')
  })

  it('clears education when an empty array is sent', async () => {
    const result = await callHandler(validBody({ education: [] })) as Record<string, unknown>

    expect(prisma.organizerProfile.update).toHaveBeenCalledWith({
      where: { id: 'profile-1' },
      data: expect.objectContaining({ education: [] }),
    })
    expect(result.education).toEqual([])
  })

  it('replaces education when a new array is sent', async () => {
    await callHandler(validBody({ education: ['УПА, магістратура'] }))

    expect(prisma.organizerProfile.update).toHaveBeenCalledWith({
      where: { id: 'profile-1' },
      data: expect.objectContaining({ education: ['УПА, магістратура'] }),
    })
  })
})
