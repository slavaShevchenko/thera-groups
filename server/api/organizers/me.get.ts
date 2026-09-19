import { requireAuth } from '../../utils/auth'
import { organizerRepository } from '../../repositories/organizerRepository'
import { apiError } from '../../utils/apiError'
import { ErrorCodes } from '../../utils/errorCodes'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)

  const profile = await organizerRepository.findByUserId(user.id)

  if (!profile) {
    throw apiError(404, ErrorCodes.NOT_FOUND, 'Organizer profile not found')
  }

  return {
    id: profile.id,
    slug: profile.slug,
    firstName: profile.firstName,
    lastName: profile.lastName,
    bio: profile.bio,
    qualification: profile.qualification,
    avatarUrl: profile.avatarUrl,
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
    verificationStatus: profile.verificationStatus,
    specializations: profile.specializations,
  }
})
