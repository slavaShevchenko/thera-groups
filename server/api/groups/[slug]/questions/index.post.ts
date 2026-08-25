import { z } from 'zod'
import { requireAuth } from '../../../../utils/auth'
import { prisma } from '../../../../utils/prisma'

const questionSchema = z.object({
  question: z.string().min(1).max(500),
  type: z.enum(['TEXT', 'SINGLE_CHOICE', 'MULTIPLE_CHOICE']),
  required: z.boolean().default(false),
  options: z.array(z.string()).max(10).default([]),
})

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const slug = getRouterParam(event, 'slug')
  if (!slug) throw createError({ statusCode: 400, statusMessage: 'Slug is required' })

  const group = await prisma.group.findUnique({
    where: { slug },
    include: { organizer: true },
  })
  if (!group) throw createError({ statusCode: 404, statusMessage: 'Group not found' })
  if (group.organizer.userId !== user.id && user.role !== 'ADMIN') {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }

  const body = await readBody(event)
  let data
  try {
    data = questionSchema.parse(body)
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

  if ((data.type === 'SINGLE_CHOICE' || data.type === 'MULTIPLE_CHOICE') && data.options.length < 2) {
    throw createError({ statusCode: 400, statusMessage: 'Choice questions require at least 2 options' })
  }

  const maxPosition = await prisma.applicationQuestion.findFirst({
    where: { groupId: group.id },
    orderBy: { position: 'desc' },
    select: { position: true },
  })

  const question = await prisma.applicationQuestion.create({
    data: {
      groupId: group.id,
      question: data.question,
      type: data.type,
      required: data.required,
      options: data.options,
      position: (maxPosition?.position ?? -1) + 1,
    },
  })

  return {
    id: question.id,
    question: question.question,
    type: question.type,
    required: question.required,
    position: question.position,
    options: question.options,
  }
})
