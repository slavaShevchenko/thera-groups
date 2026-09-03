import { getUser } from '../../utils/auth'
import { prisma } from '../../utils/prisma'

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug')

  if (!slug) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Slug is required',
    })
  }

  // Сначала ищем VERIFIED профиль (публичный доступ)
  let profile = await prisma.organizerProfile.findUnique({
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

  // Если не VERIFIED — проверяем, может текущий юзер ADMIN
  if (!profile) {
    const currentUser = await getUser(event)
    if (currentUser?.role === 'ADMIN') {
      profile = await prisma.organizerProfile.findUnique({
        where: { slug },
        include: {
          groups: {
            include: {
              organizer: {
                select: {
                  firstName: true,
                  lastName: true,
                  avatar: true,
                },
              },
            },
            orderBy: { startsAt: 'asc' },
          },
        },
      })
    }
  }

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
    whatsappUrl: profile.whatsappUrl,
    facebookUrl: profile.facebookUrl,
    youtubeUrl: profile.youtubeUrl,
    tiktokUrl: profile.tiktokUrl,
    specializations: profile.specializations,
    groups: profile.groups,
  }
})
