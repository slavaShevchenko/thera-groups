import { z } from 'zod'
import { requireRole } from '../utils/auth'
import { prisma } from '../utils/prisma'
import { createDraftSchema } from '../validators/group'
import { generateUniqueSlug } from '../utils/slugify'

export default defineEventHandler(async (event) => {
  const user = await requireRole(event, ['ORGANIZER'])

  const profile = await prisma.organizerProfile.findUnique({
    where: { userId: user.id },
  })

  if (!profile || profile.verificationStatus !== 'VERIFIED') {
    throw createError({
      statusCode: 403,
      statusMessage: 'Only verified organizers can create groups',
    })
  }

  const firstCategory = await prisma.groupCategory.findFirst()
  if (!firstCategory) {
    throw createError({ statusCode: 500, statusMessage: 'No categories found' })
  }

  const body = await readBody(event)

  let data
  try {
    data = createDraftSchema.parse(body)
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

  const slug = await generateUniqueSlug(
    'new-group',
    s => prisma.group.findUnique({ where: { slug: s } }).then(Boolean),
  )

  // Дефолтные даты (через неделю, +2 часа)
  const startsAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  const endsAt = new Date(startsAt.getTime() + 2 * 60 * 60 * 1000)

  const group = await prisma.group.create({
    data: {
      organizerId: profile.id,
      title: '',
      slug,
      description: '',
      categoryId: firstCategory.id,
      type: data.type,
      format: data.format,
      startsAt,
      endsAt,
      capacity: 10,
      price: 0,
      status: 'DRAFT',
    },
  })

  return {
    success: true,
    group: {
      id: group.id,
      slug: group.slug,
      title: group.title,
      status: group.status,
    },
  }
})
