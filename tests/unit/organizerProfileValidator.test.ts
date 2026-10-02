import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PROFILE_LIMITS } from '../../shared/constants/limits'

vi.mock('~~/server/utils/prisma', () => ({ prisma: globalThis.prisma }))

// eslint-disable-next-line import/first -- import must follow vi.mock()
import { updateOrganizerProfileSchema } from '../../server/validators/organizerProfile'
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

describe('updateOrganizerProfileSchema required fields', () => {
  it('rejects an empty qualification', () => {
    expect(failedPaths(validPayload({ qualification: '' }))).toContain('qualification')
  })

  it('rejects a whitespace-only qualification', () => {
    expect(failedPaths(validPayload({ qualification: '   ' }))).toContain('qualification')
  })

  it('rejects a whitespace-only professionalOrganization', () => {
    expect(failedPaths(validPayload({ professionalOrganization: '   ' })))
      .toContain('professionalOrganization')
  })

  it('rejects a missing qualification', () => {
    const payload = validPayload()
    delete (payload as Record<string, unknown>).qualification
    expect(failedPaths(payload)).toContain('qualification')
  })

  it('rejects an empty professionalOrganization', () => {
    expect(failedPaths(validPayload({ professionalOrganization: '' })))
      .toContain('professionalOrganization')
  })

  it('rejects an empty professionalOrganizationStatus', () => {
    expect(failedPaths(validPayload({ professionalOrganizationStatus: '' })))
      .toContain('professionalOrganizationStatus')
  })

  it('accepts a fully filled valid profile', () => {
    const parsed = updateOrganizerProfileSchema.safeParse(validPayload())
    expect(parsed.success).toBe(true)
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

  it('defaults education to an empty array when omitted', () => {
    const payload = validPayload()
    delete (payload as Record<string, unknown>).education
    const parsed = updateOrganizerProfileSchema.safeParse(payload)

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
