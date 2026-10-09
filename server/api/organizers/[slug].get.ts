import { getUser } from '../../utils/auth'
import { organizerRepository } from '../../repositories/organizerRepository'
import { apiError } from '../../utils/apiError'
import { ErrorCodes } from '../../utils/errorCodes'
import { mapGroupCard } from '../../utils/groupResponse'

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
    // The slug, not the profile cuid: it is the only identifier a public page needs, and
    // the cuid was reachable by any anonymous visitor for no reason.
    id: profile.slug,
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
    professionalOrganization: profile.professionalOrganization,
    professionalOrganizationStatus: profile.professionalOrganizationStatus,
    telegramUrl: profile.telegramUrl,
    instagramUrl: profile.instagramUrl,
    linkedinUrl: profile.linkedinUrl,
    whatsappUrl: profile.whatsappUrl,
    facebookUrl: profile.facebookUrl,
    youtubeUrl: profile.youtubeUrl,
    verificationStatus: profile.verificationStatus,
    specializations: profile.specializations,
    groups: profile.groups.map(mapGroupCard),
  }
})
