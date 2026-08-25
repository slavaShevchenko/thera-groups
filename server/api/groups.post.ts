import { z } from 'zod'
import { requireRole } from '../utils/auth'
import { prisma } from '../utils/prisma'
import { createGroupSchema } from '../validators/group'
import { slugify, randomSuffix } from '../utils/slugify'

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

  const body = await readBody(event)

  let data
  try {
    data = createGroupSchema.parse(body)
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

  // Проверяем существование категории
  const category = await prisma.groupCategory.findUnique({ where: { id: data.categoryId } })
  if (!category) {
    throw createError({ statusCode: 400, statusMessage: 'Category not found' })
  }

  // Проверяем теги
  if (data.tagIds?.length) {
    const tags = await prisma.groupTag.findMany({ where: { id: { in: data.tagIds } } })
    if (tags.length !== data.tagIds.length) {
      throw createError({ statusCode: 400, statusMessage: 'Some tags not found' })
    }
  }

  // Валидация: OFFLINE требует location
  if (data.format === 'OFFLINE' && !data.location) {
    throw createError({ statusCode: 400, statusMessage: 'Location is required for offline groups' })
  }

  // Валидация: startDate в будущем
  if (new Date(data.startDate) <= new Date()) {
    throw createError({ statusCode: 400, statusMessage: 'Start date must be in the future' })
  }

  // Генерируем slug
  const baseSlug = slugify(data.title)
  let slug = `${baseSlug}-${randomSuffix()}`
  for (let i = 0; i < 5; i++) {
    const existing = await prisma.group.findUnique({ where: { slug } })
    if (!existing) break
    slug = `${baseSlug}-${randomSuffix()}`
  }

  // Парсим даты
  const startsAt = new Date(data.startDate)
  const endsAt = data.endDate ? new Date(data.endDate) : startsAt

  const group = await prisma.group.create({
    data: {
      organizerId: profile.id,
      title: data.title,
      slug,
      description: data.description,
      categoryId: data.categoryId,
      type: data.type,
      format: data.format,
      location: data.location ?? null,
      startsAt,
      endsAt,
      capacity: data.maxParticipants ?? 10,
      price: data.price ?? 0,
      status: 'DRAFT',
      ...(data.tagIds?.length && {
        tags: {
          connect: data.tagIds.map(id => ({ id })),
        },
      }),
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
