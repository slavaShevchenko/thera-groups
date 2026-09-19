import { getUser } from '../../utils/auth'
import { organizerRepository } from '../../repositories/organizerRepository'

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug')

  if (!slug) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Slug is required',
    })
  }

  const profile = await organizerRepository.findBySlugWithGroups(slug)

  if (!profile) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Organizer not found',
    })
  }

  const isVerified = profile.verificationStatus === 'VERIFIED'

  if (!isVerified) {
    const currentUser = await getUser(event)
    if (currentUser?.role !== 'ADMIN') {
      throw createError({
        statusCode: 404,
        statusMessage: 'Organizer not found',
      })
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
