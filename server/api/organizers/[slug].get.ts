import { getUser } from '../../utils/auth'
import { organizerRepository } from '../../repositories/organizerRepository'
import { apiError } from '../../utils/apiError'
import { ErrorCodes } from '../../utils/errorCodes'

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug')

  if (!slug) {
    throw apiError(400, ErrorCodes.VALIDATION_FAILED, 'Slug is required')
  }

  const profile = await organizerRepository.findBySlugWithGroups(slug)

  if (!profile) {
    throw apiError(404, ErrorCodes.NOT_FOUND, 'Organizer not found')
  }

  const isVerified = profile.verificationStatus === 'VERIFIED'

  if (!isVerified) {
    const currentUser = await getUser(event)
    if (currentUser?.role !== 'ADMIN') {
      throw apiError(404, ErrorCodes.NOT_FOUND, 'Organizer not found')
    }
  }

  return {
    id: profile.id,
    slug: profile.slug,
    firstName: profile.firstName,
    lastName: profile.lastName,
    avatarUrl: profile.avatarUrl,
    bio: profile.bio,
    qualification: profile.qualification,
    experienceYears: profile.experienceYears,
    languages: profile.languages,
    workFormats: profile.workFormats,
    city: profile.city,
    education: profile.education,
    telegramUrl: profile.telegramUrl,
    instagramUrl: profile.instagramUrl,
    linkedinUrl: profile.linkedinUrl,
    whatsappUrl: profile.whatsappUrl,
    facebookUrl: profile.facebookUrl,
    youtubeUrl: profile.youtubeUrl,
    tiktokUrl: profile.tiktokUrl,
    specializations: profile.specializations,
    groups: profile.groups,
  }
})
