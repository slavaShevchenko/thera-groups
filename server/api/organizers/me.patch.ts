import { z } from 'zod'
import { requireAuth } from '../../utils/auth'
import { prisma } from '../../utils/prisma'
import { updateOrganizerProfileSchema } from '../../validators/organizerProfile'

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

  const body = await readBody(event)

  let data
  try {
    data = updateOrganizerProfileSchema.parse(body)
  }
  catch (error) {
    if (error instanceof z.ZodError) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Validation failed',
        data: { details: error.issues },
      })
    }
    throw error
  }

  const { specializationIds, customSpecializations, ...rest } = data

  // Очищаем пустые строки
  const updateData: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(rest)) {
    if (value !== undefined) {
      updateData[key] = value === '' ? null : value
    }
  }

  // Обновляем профиль
  const updated = await prisma.organizerProfile.update({
    where: { id: profile.id },
    data: {
      ...updateData,
      customSpecializations: customSpecializations ?? undefined,
      ...(specializationIds !== undefined && {
        specializations: {
          set: specializationIds.map(id => ({ id })),
        },
      }),
    },
    include: {
      specializations: {
        select: { id: true, nameUa: true, nameEn: true, slug: true },
      },
    },
  })

  return {
    id: updated.id,
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
    verificationStatus: updated.verificationStatus,
    customSpecializations: updated.customSpecializations,
    specializations: updated.specializations,
  }
})
