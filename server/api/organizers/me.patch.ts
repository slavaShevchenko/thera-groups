import { requireAuth } from '../../utils/auth'
import { organizerRepository } from '../../repositories/organizerRepository'
import { updateOrganizerProfileSchema } from '../../validators/organizerProfile'
import { slugify } from '../../utils/slugify'
import { apiError } from '../../utils/apiError'
import { ErrorCodes } from '../../utils/errorCodes'
import { mapPrismaError } from '../../utils/errorHandler'
import { PROFILE_LIMITS } from '~~/shared/constants/limits'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)

  const profile = await organizerRepository.findByUserId(user.id)

  if (!profile) {
    throw apiError(404, ErrorCodes.NOT_FOUND, 'Organizer profile not found')
  }

  const body = await readBody(event)

  const parsed = updateOrganizerProfileSchema.safeParse(body)
  if (!parsed.success) {
    throw apiError(400, ErrorCodes.VALIDATION_FAILED, 'Validation failed', {
      issues: parsed.error.issues.map(i => ({
        path: i.path.join('.'),
        message: i.message,
      })),
    })
  }

  const data = parsed.data

  const { specializations, education, ...rest } = data

  // `professionalOrganization` and `professionalOrganizationStatus` are declared
  // `String @default("")` — NOT NULL — so blanking them means writing '', not NULL. Every
  // other field a form can empty here is nullable. Before the PATCH schema made these
  // optional an empty value could not reach this loop at all, so the blanket `'' → null`
  // below was untested against exactly the two columns that reject it.
  const nonNullableText = new Set(['professionalOrganization', 'professionalOrganizationStatus'])

  const updateData: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(rest)) {
    if (value === undefined) continue
    updateData[key] = value === '' && !nonNullableText.has(key) ? null : value
  }

  if (education !== undefined) {
    updateData.education = education
      .map(item => item.trim())
      .filter(item => item.length > 0 && item.length <= PROFILE_LIMITS.EDUCATION_MAX)
  }

  const newFirstName = (updateData.firstName as string) ?? profile.firstName
  const newLastName = (updateData.lastName as string) ?? profile.lastName

  if (newFirstName !== profile.firstName || newLastName !== profile.lastName) {
    const baseSlug = slugify(`${newFirstName} ${newLastName}`)

    if (baseSlug) {
      let slug = baseSlug
      let suffix = 1

      while (await organizerRepository.slugExists(slug)) {
        if (slug === profile.slug) break
        slug = `${baseSlug}-${suffix++}`
      }

      updateData.slug = slug
    }
  }

  if (specializations !== undefined) {
    const seen = new Set<string>()
    const unique = specializations
      .map(s => s.trim())
      .filter(s => s.length > 0 && s.length <= PROFILE_LIMITS.SPECIALIZATION_MAX)
      .filter((s) => {
        const lower = s.toLowerCase()
        if (seen.has(lower)) return false
        seen.add(lower)
        return true
      })
      .slice(0, 20)

    updateData.specializations = unique
  }

  // A REJECTED organizer has no way back: the admin UI only surfaces PENDING profiles,
  // and the PATCH schema intentionally never accepts `verificationStatus` from the client.
  // Any save on a rejected profile is a resubmission — reset the status to PENDING and
  // clear the rejection reason so it re-enters the moderation queue. A VERIFIED or
  // PENDING profile is left untouched by this rule.
  if (profile.verificationStatus === 'REJECTED') {
    updateData.verificationStatus = 'PENDING'
    updateData.rejectionReason = null
  }

  try {
    const updated = await organizerRepository.update(profile.id, updateData)

    return {
      id: updated.id,
      slug: updated.slug,
      firstName: updated.firstName,
      lastName: updated.lastName,
      bio: updated.bio,
      qualification: updated.qualification,
      avatarUrl: updated.avatarUrl,
      experienceYears: updated.experienceYears,
      languages: updated.languages,
      workFormats: updated.workFormats,
      city: updated.city,
      education: updated.education,
      professionalOrganization: updated.professionalOrganization,
      professionalOrganizationStatus: updated.professionalOrganizationStatus,
      telegramUrl: updated.telegramUrl,
      instagramUrl: updated.instagramUrl,
      linkedinUrl: updated.linkedinUrl,
      whatsappUrl: updated.whatsappUrl,
      facebookUrl: updated.facebookUrl,
      youtubeUrl: updated.youtubeUrl,
      verificationStatus: updated.verificationStatus,
      specializations: updated.specializations,
    }
  }
  catch (error) {
    if (error && typeof error === 'object' && 'statusCode' in error) throw error
    throw mapPrismaError(error, 'organizers.me.patch')
  }
})
