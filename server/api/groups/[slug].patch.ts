import { z } from 'zod'
import { requireAuth } from '../../utils/auth'
import { prisma } from '../../utils/prisma'
import { updateGroupSchema } from '../../validators/group'
import { generateUniqueSlug } from '../../utils/slugify'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const slug = getRouterParam(event, 'slug')

  if (!slug) {
    throw createError({ statusCode: 400, statusMessage: 'Slug is required' })
  }

  const existing = await prisma.group.findUnique({
    where: { slug },
    include: { organizer: true },
  })

  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Group not found' })
  }

  if (existing.organizer.userId !== user.id && user.role !== 'ADMIN') {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }

  const body = await readBody(event)

  let data
  try {
    data = updateGroupSchema.parse(body)
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

  // Проверяем категорию
  if (data.categoryId) {
    const category = await prisma.groupCategory.findUnique({ where: { id: data.categoryId } })
    if (!category) {
      throw createError({ statusCode: 400, statusMessage: 'Category not found' })
    }
  }

  // Проверяем теги
  if (data.tagIds) {
    const tags = await prisma.groupTag.findMany({ where: { id: { in: data.tagIds } } })
    if (tags.length !== data.tagIds.length) {
      throw createError({ statusCode: 400, statusMessage: 'Some tags not found' })
    }
  }

  // Собираем update data — маппим поля правильно
  const updateData: Record<string, unknown> = {}

  // Прямые поля (без трансформации)
  if (data.title !== undefined) updateData.title = data.title
  if (data.description !== undefined) updateData.description = data.description
  if (data.type !== undefined) updateData.type = data.type
  if (data.format !== undefined) updateData.format = data.format
  if (data.time !== undefined) updateData.time = data.time
  if (data.location !== undefined) updateData.location = data.location
  if (data.price !== undefined) updateData.price = data.price ?? 0
  if (data.status !== undefined) updateData.status = data.status

  // Поля с трансформацией имён
  if (data.maxParticipants !== undefined) updateData.capacity = data.maxParticipants ?? 10

  // Дата — конвертируем строку в Date
  if (data.startDate) updateData.startsAt = new Date(data.startDate)
  if (data.endDate) updateData.endsAt = new Date(data.endDate)

  // Категория — через connect
  if (data.categoryId) {
    updateData.category = { connect: { id: data.categoryId } }
  }

  if (data.title && data.title !== existing.title) {
    updateData.slug = await generateUniqueSlug(
      data.title,
      s => prisma.group.findUnique({ where: { slug: s } }).then(Boolean),
    )
  }

  const updated = await prisma.group.update({
    where: { id: existing.id },
    data: {
      ...updateData,
      ...(data.tagIds !== undefined && {
        tags: {
          set: data.tagIds.map(id => ({ id })),
        },
      }),
    },
  })

  // Обновляем вопросы если переданы
  if (data.questions !== undefined) {
    await prisma.applicationQuestion.deleteMany({
      where: { groupId: existing.id },
    })

    for (let i = 0; i < data.questions.length; i++) {
      const q = data.questions[i]

      if ((q.type === 'SINGLE_CHOICE' || q.type === 'MULTIPLE_CHOICE') && q.options.length < 2) {
        throw createError({
          statusCode: 400,
          statusMessage: `Question "${q.question}" requires at least 2 options`,
        })
      }

      await prisma.applicationQuestion.create({
        data: {
          groupId: existing.id,
          question: q.question,
          type: q.type,
          required: q.required,
          options: q.options,
          position: i,
        },
      })
    }
  }

  return {
    success: true,
    group: {
      id: updated.id,
      slug: updated.slug,
      title: updated.title,
      status: updated.status,
    },
  }
})
