import { z } from 'zod'
import { requireAuth } from '../../utils/auth'
import { prisma } from '../../utils/prisma'
import { updateGroupSchema } from '../../validators/group'
import { slugify, randomSuffix } from '../../utils/slugify'

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

  // Пересчитываем slug при смене title
  const updateData: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined && key !== 'tagIds' && key !== 'questions') {
      updateData[key] = value
    }
  }

  if (data.startDate) updateData.startsAt = new Date(data.startDate)
  if (data.endDate) updateData.endsAt = new Date(data.endDate)

  if (data.title && data.title !== existing.title) {
    const baseSlug = slugify(data.title)
    let newSlug = `${baseSlug}-${randomSuffix()}`
    for (let i = 0; i < 5; i++) {
      const conflict = await prisma.group.findUnique({ where: { slug: newSlug } })
      if (!conflict || newSlug === existing.slug) break
      newSlug = `${baseSlug}-${randomSuffix()}`
    }
    updateData.slug = newSlug
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
    // Удаляем все существующие вопросы группы
    await prisma.applicationQuestion.deleteMany({
      where: { groupId: existing.id },
    })

    // Создаём новые вопросы с правильными позициями
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
