import { prisma } from '../../../../utils/prisma'
import { requireAuth } from '../../../../utils/auth'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const slug = getRouterParam(event, 'slug')

  const group = await prisma.group.findUnique({
    where: { slug },
    select: {
      id: true,
      organizer: { select: { userId: true } },
    },
  })

  if (!group) {
    throw createError({ statusCode: 404, statusMessage: 'Group not found' })
  }

  if (group.organizer.userId !== user.id && user.role !== 'ADMIN') {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }

  const query = getQuery(event)
  const status = typeof query.status === 'string' ? query.status : undefined
  const orderByField = typeof query.orderBy === 'string' ? query.orderBy : 'createdAt'

  const orderBy = orderByField === 'status'
    ? { status: 'asc' as const }
    : { createdAt: 'desc' as const }

  const applications = await prisma.application.findMany({
    where: {
      groupId: group.id,
      ...(status && { status }),
    },
    include: {
      answers: {
        include: {
          question: {
            select: {
              id: true,
              question: true,
              type: true,
            },
          },
        },
      },
    },
    orderBy,
    take: 50,
  })

  return {
    applications: applications.map(a => ({
      id: a.id,
      name: a.name,
      email: a.email,
      phone: a.phone,
      status: a.status,
      createdAt: a.createdAt,
      answers: a.answers.map(ans => ({
        questionId: ans.questionId,
        question: ans.question.question,
        type: ans.question.type,
        value: ans.value,
      })),
    })),
  }
})
