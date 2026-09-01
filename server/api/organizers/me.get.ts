import { requireAuth } from '../../utils/auth'
import { prisma } from '../../utils/prisma'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)

  const profile = await prisma.organizerProfile.findUnique({
    where: { userId: user.id },
  })

  if (!profile) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Organizer profile not found',
    })
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
    verificationStatus: profile.verificationStatus,
    specializations: profile.specializations,
  }
})
