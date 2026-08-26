import { z } from 'zod'
import { prisma } from '../../../utils/prisma'
import { applySchema } from '../../../validators/application'
import { notifyApplicationReceived } from '../../../utils/notifications'

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug')

  const group = await prisma.group.findUnique({
    where: { slug },
    select: {
      id: true,
      status: true,
      questions: {
        select: {
          id: true,
          question: true,
          type: true,
          required: true,
          options: true,
        },
      },
    },
  })

  if (!group || group.status !== 'PUBLISHED') {
    throw createError({
      statusCode: 404,
      statusMessage: 'Group not found',
    })
  }

  const body = await readBody(event)

  let data
  try {
    data = applySchema.parse(body)
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

  const questionsMap = new Map(group.questions.map(q => [q.id, q]))

  for (const answer of data.answers) {
    const question = questionsMap.get(answer.questionId)
    if (!question) {
      throw createError({
        statusCode: 400,
        statusMessage: `Question ${answer.questionId} not found for this group`,
      })
    }

    if (question.required && !answer.value.trim()) {
      throw createError({
        statusCode: 400,
        statusMessage: `Question "${question.question}" is required`,
      })
    }

    if (!answer.value.trim()) continue

    if (question.type === 'SINGLE_CHOICE') {
      if (!question.options.includes(answer.value)) {
        throw createError({
          statusCode: 400,
          statusMessage: `Invalid option for "${question.question}"`,
        })
      }
    }

    if (question.type === 'MULTIPLE_CHOICE') {
      const selected = answer.value.split(',').map(s => s.trim()).filter(Boolean)
      const invalid = selected.filter(v => !question.options.includes(v))
      if (invalid.length > 0) {
        throw createError({
          statusCode: 400,
          statusMessage: `Invalid options for "${question.question}": ${invalid.join(', ')}`,
        })
      }
    }
  }

  const existing = await prisma.application.findFirst({
    where: {
      groupId: group.id,
      email: data.email,
    },
  })

  if (existing) {
    throw createError({
      statusCode: 409,
      statusMessage: 'Application with this email already exists for this group',
    })
  }

  const application = await prisma.application.create({
    data: {
      groupId: group.id,
      name: data.name,
      email: data.email,
      phone: data.phone,
      status: 'PENDING',
      answers: {
        create: data.answers
          .filter(a => a.value.trim())
          .map(a => ({
            questionId: a.questionId,
            value: a.value,
          })),
      },
    },
    select: {
      id: true,
      status: true,
      createdAt: true,
    },
  })

  const fullGroup = await prisma.group.findUnique({
    where: { id: group.id },
    include: { organizer: { select: { userId: true } } },
  })

  if (fullGroup) {
    await notifyApplicationReceived(
      fullGroup.organizer.userId,
      data.name,
      fullGroup.title,
      fullGroup.slug,
    )
  }

  return { application }
})
