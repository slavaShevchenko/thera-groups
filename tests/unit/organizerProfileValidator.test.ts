import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PROFILE_LIMITS } from '../../shared/constants/limits'

vi.mock('~~/server/utils/prisma', () => ({ prisma: globalThis.prisma }))

// eslint-disable-next-line import/first -- import must follow vi.mock()
import { updateOrganizerProfileSchema } from '../../server/validators/organizerProfile'
// eslint-disable-next-line import/first -- import must follow vi.mock()
import { registerSchema } from '../../server/validators/auth'
// eslint-disable-next-line import/first -- import must follow vi.mock()
import { organizerRepository } from '../../server/repositories/organizerRepository'

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- globalThis.prisma is set in test setup
const prisma = globalThis.prisma as any

function validPayload(overrides: Record<string, unknown> = {}) {
  return {
    firstName: 'Олена',
    lastName: 'Коваленко',
    bio: 'Клінічний психолог з 10-річним досвідом.',
    qualification: 'Магістр психології, КПТ-терапевт',
    experienceYears: 10,
    languages: ['uk', 'en'],
    workFormats: ['ONLINE'],
    city: 'Київ',
    education: ['КНУ ім. Шевченка, факультет психології'],
    professionalOrganization: 'Українська спілка психотерапевтів',
    professionalOrganizationStatus: 'Дійсний член',
    telegramUrl: 'https://t.me/olena',
    instagramUrl: '',
    linkedinUrl: '',
    whatsappUrl: '',
    facebookUrl: '',
    youtubeUrl: '',
    specializations: ['Тривожні розлади'],
    ...overrides,
  }
}

function failedPaths(payload: unknown): string[] {
  const parsed = updateOrganizerProfileSchema.safeParse(payload)
  return parsed.success ? [] : parsed.error.issues.map(issue => issue.path.join('.'))
}

function registerNamePaths(firstName: string, lastName: string): string[] {
  const parsed = registerSchema.safeParse({
    email: 'olena@example.com',
    password: 'strong-password',
    role: 'ORGANIZER',
    organizerData: { firstName, lastName },
  })
  return parsed.success ? [] : parsed.error.issues.map(issue => issue.path.join('.'))
}

function chars(length: number): string {
  return 'a'.repeat(length)
}

describe('updateOrganizerProfileSchema limits', () => {
  it('rejects bio longer than BIO_MAX', () => {
    expect(failedPaths(validPayload({ bio: chars(PROFILE_LIMITS.BIO_MAX + 1) }))).toContain('bio')
  })

  it('accepts bio exactly at BIO_MAX', () => {
    expect(failedPaths(validPayload({ bio: chars(PROFILE_LIMITS.BIO_MAX) }))).toEqual([])
  })

  it('rejects firstName longer than FIRST_NAME_MAX', () => {
    expect(failedPaths(validPayload({ firstName: chars(PROFILE_LIMITS.FIRST_NAME_MAX + 1) })))
      .toContain('firstName')
  })

  it('rejects lastName longer than LAST_NAME_MAX', () => {
    expect(failedPaths(validPayload({ lastName: chars(PROFILE_LIMITS.LAST_NAME_MAX + 1) })))
      .toContain('lastName')
  })

  it('rejects a specialization longer than SPECIALIZATION_MAX', () => {
    expect(failedPaths(validPayload({ specializations: [chars(PROFILE_LIMITS.SPECIALIZATION_MAX + 1)] })))
      .toContain('specializations.0')
  })

  it('rejects city longer than CITY_MAX', () => {
    expect(failedPaths(validPayload({ city: chars(PROFILE_LIMITS.CITY_MAX + 1) }))).toContain('city')
  })

  it('rejects a social url longer than SOCIAL_URL_MAX', () => {
    const tooLong = `https://t.me/${chars(PROFILE_LIMITS.SOCIAL_URL_MAX)}`
    expect(tooLong.length).toBeGreaterThan(PROFILE_LIMITS.SOCIAL_URL_MAX)
    expect(failedPaths(validPayload({ telegramUrl: tooLong }))).toContain('telegramUrl')
  })

  it('rejects an education entry longer than EDUCATION_MAX', () => {
    expect(failedPaths(validPayload({ education: [chars(PROFILE_LIMITS.EDUCATION_MAX + 1)] })))
      .toContain('education.0')
  })

  it('rejects qualification longer than QUALIFICATION_MAX', () => {
    expect(failedPaths(validPayload({ qualification: chars(PROFILE_LIMITS.QUALIFICATION_MAX + 1) })))
      .toContain('qualification')
  })
})

// A PATCH schema. Every field is individually optional: a required one means the client has
// to resend the whole profile on every write, and an autosave that touched only `bio` used
// to come back 400 naming three fields nobody was editing. Completeness is enforced where
// it decides something — before an admin may verify the profile — not on every save.
describe('updateOrganizerProfileSchema as a partial update', () => {
  it('accepts a payload that touches only bio', () => {
    const parsed = updateOrganizerProfileSchema.safeParse({ bio: 'Нова біографія' })

    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.data.bio).toBe('Нова біографія')
      expect(parsed.data.qualification).toBeUndefined()
      expect(parsed.data.professionalOrganization).toBeUndefined()
      expect(parsed.data.professionalOrganizationStatus).toBeUndefined()
    }
  })

  it('accepts an empty object, which changes nothing', () => {
    expect(updateOrganizerProfileSchema.safeParse({}).success).toBe(true)
  })

  it.each([
    'qualification',
    'professionalOrganization',
    'professionalOrganizationStatus',
  ])('omits %s rather than defaulting it, so the handler leaves the stored value alone', (field) => {
    const { [field]: _omitted, ...payload } = validPayload() as Record<string, unknown>

    expect(payload).not.toHaveProperty(field)

    const parsed = updateOrganizerProfileSchema.safeParse(payload)

    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.data).not.toHaveProperty(field)
    }
  })

  it.each([
    'qualification',
    'professionalOrganization',
    'professionalOrganizationStatus',
  ])('accepts an empty %s as an explicit clear', (field) => {
    const parsed = updateOrganizerProfileSchema.safeParse({ [field]: '' })

    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.data[field as keyof typeof parsed.data]).toBe('')
    }
  })

  it('accepts a whitespace-only qualification now that clearing is a caller decision', () => {
    const parsed = updateOrganizerProfileSchema.safeParse({ qualification: '   ' })

    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.data.qualification).toBe('')
    }
  })

  it('still bounds what it accepts when a field is present', () => {
    expect(failedPaths({ qualification: chars(PROFILE_LIMITS.QUALIFICATION_MAX + 1) }))
      .toContain('qualification')
    expect(failedPaths({ professionalOrganization: chars(PROFILE_LIMITS.PROFESSIONAL_ORG_MAX + 1) }))
      .toContain('professionalOrganization')
    expect(failedPaths({ professionalOrganizationStatus: chars(PROFILE_LIMITS.PROFESSIONAL_ORG_STATUS_MAX + 1) }))
      .toContain('professionalOrganizationStatus')
  })

  it('still refuses a name that is too short to be a name', () => {
    expect(failedPaths({ firstName: 'І' })).toContain('firstName')
  })

  it('accepts a fully filled valid profile', () => {
    const parsed = updateOrganizerProfileSchema.safeParse(validPayload())
    expect(parsed.success).toBe(true)
  })
})

// The fields the schema stopped requiring are still required to be *verified*. This is the
// contract the two halves share, asserted here so moving one without the other fails.
describe('VERIFICATION_REQUIRED_FIELDS', () => {
  it('names exactly the fields the profile page advertises', async () => {
    const { VERIFICATION_REQUIRED_FIELDS } = await import('../../shared/constants/verification')

    expect(VERIFICATION_REQUIRED_FIELDS).toEqual([
      'qualification',
      'professionalOrganization',
      'professionalOrganizationStatus',
    ])
  })

  it('keeps every one of them optional on the PATCH schema', async () => {
    const { VERIFICATION_REQUIRED_FIELDS } = await import('../../shared/constants/verification')

    for (const field of VERIFICATION_REQUIRED_FIELDS) {
      const parsed = updateOrganizerProfileSchema.safeParse({})
      expect(parsed.success, `${field} must not be required to save`).toBe(true)
    }
  })
})

describe('education as a multi-value field', () => {
  it('keeps all three entries when parsing', () => {
    const education = ['КНУ ім. Шевченка', 'УПА, магістратура', 'КПТ-сертифікація']
    const parsed = updateOrganizerProfileSchema.safeParse(validPayload({ education }))

    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.data.education).toEqual(education)
    }
  })

  it('leaves education undefined when omitted so a partial PATCH cannot wipe it', () => {
    const payload = validPayload()
    delete (payload as Record<string, unknown>).education
    const parsed = updateOrganizerProfileSchema.safeParse(payload)

    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.data.education).toBeUndefined()
    }
  })

  it('accepts an explicit empty education array', () => {
    const parsed = updateOrganizerProfileSchema.safeParse(validPayload({ education: [] }))

    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.data.education).toEqual([])
    }
  })

  it('ignores the removed tiktokUrl field', () => {
    const parsed = updateOrganizerProfileSchema.safeParse(validPayload({ tiktokUrl: 'https://tiktok.com/@x' }))

    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.data).not.toHaveProperty('tiktokUrl')
    }
  })
})

describe('name minimum length parity between register and profile edit', () => {
  it('rejects a single-character firstName in both schemas', () => {
    expect(registerNamePaths('І', 'Коваленко')).toContain('organizerData.firstName')
    expect(failedPaths(validPayload({ firstName: 'І' }))).toContain('firstName')
  })

  it('rejects a single-character lastName in both schemas', () => {
    expect(registerNamePaths('Олена', 'К')).toContain('organizerData.lastName')
    expect(failedPaths(validPayload({ lastName: 'К' }))).toContain('lastName')
  })

  it('accepts a two-character name in both schemas', () => {
    expect(registerNamePaths('Ія', 'Коваленко')).toEqual([])
    expect(failedPaths(validPayload({ firstName: 'Ія' }))).toEqual([])
  })
})

describe('organizerRepository education round-trip', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('writes and reads back an education array', async () => {
    const education = ['КНУ ім. Шевченка', 'УПА, магістратура', 'КПТ-сертифікація']
    const stored = { id: 'profile-1', education }

    prisma.organizerProfile.update.mockResolvedValue(stored)
    const updated = await organizerRepository.update('profile-1', { education })
    expect(prisma.organizerProfile.update).toHaveBeenCalledWith({
      where: { id: 'profile-1' },
      data: { education },
    })
    expect(updated.education).toEqual(education)

    prisma.organizerProfile.findUnique.mockResolvedValue(stored)
    const read = await organizerRepository.findById('profile-1')
    expect(read?.education).toEqual(education)
  })
})
