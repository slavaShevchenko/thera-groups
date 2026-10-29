import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createEvent } from 'h3'
import { PROFILE_LIMITS } from '../../../shared/constants/limits'

vi.mock('~~/server/utils/prisma', () => ({ prisma: globalThis.prisma }))

vi.mock('~~/server/utils/auth', () => ({
  requireAuth: vi.fn(),
  getUser: vi.fn(),
}))

// The handler notifies the admins after it creates the profile. Without this mock the real
// module runs against the global Prisma stub, `findMany` returns undefined and the failure
// is swallowed by the handler's own catch — the test would pass while asserting nothing.
// Resolves, because the handler chains `.catch()` onto the returned promise.
vi.mock('~~/server/utils/notifications', () => ({
  notifyAdminsOrganizerPendingReview: vi.fn().mockResolvedValue(undefined),
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

function makePostEvent(body: unknown) {
  const event = createEvent(
    { url: '/api/organizers/me', method: 'POST', headers: { 'content-type': 'application/json' } },
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

async function callPostHandler(body: unknown) {
  const mod = await import('../../../server/api/organizers/me.post')
  const handler = mod.default as unknown as (_event: unknown) => Promise<unknown>
  return handler(makePostEvent(body))
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

  it('saves a patch that touches one field without asking for the rest', async () => {
    // The form autosaves. A required field on a PATCH schema turns every autosave that
    // did not resend the whole profile into a 400 naming fields nobody was editing.
    await expect(callHandler({ bio: 'Оновлена біографія.' })).resolves.toBeDefined()

    expect(prisma.organizerProfile.update).toHaveBeenCalledWith({
      where: { id: 'profile-1' },
      data: { bio: 'Оновлена біографія.' },
    })
  })

  it('leaves every omitted field out of the write, so nothing is silently reset', async () => {
    await callHandler({ city: 'Львів' })

    const updateArg = prisma.organizerProfile.update.mock.calls[0][0]
    expect(updateArg.data).toEqual({ city: 'Львів' })
    expect(updateArg.data).not.toHaveProperty('qualification')
    expect(updateArg.data).not.toHaveProperty('professionalOrganization')
    expect(updateArg.data).not.toHaveProperty('education')
  })

  it('clears a nullable field with an empty string', async () => {
    await callHandler({ qualification: '' })

    expect(prisma.organizerProfile.update).toHaveBeenCalledWith({
      where: { id: 'profile-1' },
      data: { qualification: null },
    })
  })

  it('clears a NOT NULL field to an empty string rather than to null', async () => {
    // `professionalOrganization` and its status are `String @default("")` in the schema.
    // Writing NULL to them is a database error, and before the PATCH schema made them
    // optional an empty value could not reach this branch to find that out.
    await callHandler({ professionalOrganization: '', professionalOrganizationStatus: '' })

    expect(prisma.organizerProfile.update).toHaveBeenCalledWith({
      where: { id: 'profile-1' },
      data: { professionalOrganization: '', professionalOrganizationStatus: '' },
    })
  })

  it('returns 400 with an issue on qualification when it exceeds the limit', async () => {
    await expect(callHandler({ qualification: 'a'.repeat(PROFILE_LIMITS.QUALIFICATION_MAX + 1) }))
      .rejects
      .toMatchObject({
        statusCode: 400,
        data: {
          code: 'VALIDATION_FAILED',
          issues: expect.arrayContaining([
            expect.objectContaining({ path: 'qualification' }),
          ]),
        },
      })

    expect(prisma.organizerProfile.update).not.toHaveBeenCalled()
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

describe('POST /api/organizers/me', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    mockRequireAuth.mockResolvedValue({
      id: 'user-1',
      email: 'olena@example.com',
      role: 'VISITOR',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- partial User is enough for the handler
    } as any)

    // No profile yet, and no slug taken — that is the state this endpoint exists for.
    prisma.organizerProfile.findUnique.mockResolvedValue(null)

    prisma.organizerProfile.create.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
      Promise.resolve({ id: 'profile-1', ...data }))

    prisma.user.update.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
      Promise.resolve({ id: 'user-1', ...data }))
  })

  it('creates a PENDING profile, because that is the only status the admin queue surfaces', async () => {
    const result = await callPostHandler({ firstName: 'Олена', lastName: 'Коваленко' }) as Record<string, unknown>

    expect(prisma.organizerProfile.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        firstName: 'Олена',
        lastName: 'Коваленко',
        verificationStatus: 'PENDING',
        slug: expect.any(String),
      }),
    })
    expect(result.verificationStatus).toBe('PENDING')
  })

  it('promotes a VISITOR only after the profile exists', async () => {
    await callPostHandler({ firstName: 'Олена', lastName: 'Коваленко' })

    expect(prisma.organizerProfile.create).toHaveBeenCalled()
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { role: 'ORGANIZER' },
    })
  })

  it('tells the admins a PENDING profile is waiting on them', async () => {
    // The admin queue surfaces only PENDING profiles, so a path that opens one silently
    // leaves the applicant waiting on a moderation nobody was told about.
    const { notifyAdminsOrganizerPendingReview } = await import('~~/server/utils/notifications')

    await callPostHandler({ firstName: 'Олена', lastName: 'Коваленко' })

    expect(notifyAdminsOrganizerPendingReview)
      .toHaveBeenCalledWith('Олена Коваленко', expect.any(String))
  })

  it('still returns the profile when the admin notification fails', async () => {
    // The profile and the role are durable by then. Answering 500 would leave the visitor
    // with an account they cannot create again — the retry can only return 409.
    const { notifyAdminsOrganizerPendingReview } = await import('~~/server/utils/notifications')
    vi.mocked(notifyAdminsOrganizerPendingReview).mockRejectedValueOnce(new Error('db down'))
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const result = await callPostHandler({ firstName: 'Олена', lastName: 'Коваленко' }) as Record<string, unknown>

    expect(result.verificationStatus).toBe('PENDING')
    expect(errorSpy).toHaveBeenCalled()
    errorSpy.mockRestore()
  })

  it('leaves an ADMIN role alone while still creating the profile', async () => {
    mockRequireAuth.mockResolvedValue({
      id: 'admin-1',
      email: 'admin@example.com',
      role: 'ADMIN',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- partial User is enough for the handler
    } as any)

    await callPostHandler({ firstName: 'Олена', lastName: 'Коваленко' })

    expect(prisma.organizerProfile.create).toHaveBeenCalled()
    expect(prisma.user.update).not.toHaveBeenCalled()
  })

  it('refuses a second profile with 409 instead of overwriting the first', async () => {
    prisma.organizerProfile.findUnique.mockResolvedValue({ id: 'existing', userId: 'user-1' })

    await expect(callPostHandler({ firstName: 'Олена', lastName: 'Коваленко' }))
      .rejects
      .toMatchObject({ statusCode: 409, data: { code: 'CONFLICT' } })

    expect(prisma.organizerProfile.create).not.toHaveBeenCalled()
  })

  it('returns 400 with an issue when a name is missing, and creates nothing', async () => {
    await expect(callPostHandler({ lastName: 'Коваленко' }))
      .rejects
      .toMatchObject({
        statusCode: 400,
        data: {
          code: 'VALIDATION_FAILED',
          issues: expect.arrayContaining([
            expect.objectContaining({ path: 'firstName' }),
          ]),
        },
      })

    expect(prisma.organizerProfile.create).not.toHaveBeenCalled()
    expect(prisma.user.update).not.toHaveBeenCalled()
  })

  it('rejects a name shorter than the schema minimum', async () => {
    await expect(callPostHandler({ firstName: 'О', lastName: 'Коваленко' }))
      .rejects
      .toMatchObject({
        statusCode: 400,
        data: {
          issues: expect.arrayContaining([
            expect.objectContaining({ path: 'firstName' }),
          ]),
        },
      })
  })

  it('stores an omitted qualification as null rather than as an empty string', async () => {
    await callPostHandler({ firstName: 'Олена', lastName: 'Коваленко', qualification: '' })

    expect(prisma.organizerProfile.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ qualification: null }),
    })
  })
})
