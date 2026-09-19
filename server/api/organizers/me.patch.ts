import { z } from 'zod'
import { requireAuth } from '../../utils/auth'
import { organizerRepository } from '../../repositories/organizerRepository'
import { updateOrganizerProfileSchema } from '../../validators/organizerProfile'
import { slugify } from '../../utils/slugify'
import { apiError } from '../../utils/apiError'
import { ErrorCodes } from '../../utils/errorCodes'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)

  const profile = await organizerRepository.findByUserId(user.id)

  if (!profile) {
    throw apiError(404, ErrorCodes.NOT_FOUND, 'Organizer profile not found')
  }

  const body = await readBody(event)

  let data
  try {
    data = updateOrganizerProfileSchema.parse(body)
  }
  catch (error) {
    if (error instanceof z.ZodError) {
      throw apiError(400, ErrorCodes.VALIDATION_FAILED, 'Validation failed')
    }
    throw error
  }

  const { specializations, ...rest } = data

  const updateData: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(rest)) {
    if (value !== undefined) {
      updateData[key] = value === '' ? null : value
    }
  }

  // Recalculate slug when name changes
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

  // Process specializations: trim, filter empty, deduplicate case-insensitive, limit 20
  if (specializations !== undefined) {
    const seen = new Set<string>()
    const unique = specializations
      .map(s => s.trim())
      .filter(s => s.length > 0 && s.length <= 60)
      .filter((s) => {
        const lower = s.toLowerCase()
        if (seen.has(lower)) return false
        seen.add(lower)
        return true
      })
      .slice(0, 20)

    updateData.specializations = unique
  }

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
    telegramUrl: updated.telegramUrl,
    instagramUrl: updated.instagramUrl,
    linkedinUrl: updated.linkedinUrl,
    whatsappUrl: updated.whatsappUrl,
    facebookUrl: updated.facebookUrl,
    youtubeUrl: updated.youtubeUrl,
    tiktokUrl: updated.tiktokUrl,
    verificationStatus: updated.verificationStatus,
    specializations: updated.specializations,
  }
})
