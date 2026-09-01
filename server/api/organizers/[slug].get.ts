import { prisma } from '../../utils/prisma'

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug')

  if (!slug) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Slug is required',
    })
  }

  const profile = await prisma.organizerProfile.findUnique({
    where: {
      slug,
      verificationStatus: 'VERIFIED',
    },
    include: {
      groups: {
        where: {
          status: 'PUBLISHED',
        },
        include: {
          organizer: {
            select: {
              firstName: true,
              lastName: true,
              avatar: true,
            },
          },
        },
        orderBy: {
          startsAt: 'asc',
        },
      },
    },
  })

  if (!profile) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Organizer not found',
    })
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
    specializations: profile.specializations,
    groups: profile.groups,
  }
})
