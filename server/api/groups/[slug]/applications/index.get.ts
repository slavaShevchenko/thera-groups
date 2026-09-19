import { prisma } from '../../../../utils/prisma'
import { requireAuth } from '../../../../utils/auth'
import { groupApplicationsQuerySchema } from '../../../../validators/query'
import { apiError } from '../../../../utils/apiError'
import { ErrorCodes } from '../../../../utils/errorCodes'

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
    throw apiError(404, ErrorCodes.NOT_FOUND, 'Group not found')
  }

  if (group.organizer.userId !== user.id && user.role !== 'ADMIN') {
    throw apiError(403, ErrorCodes.FORBIDDEN, 'Forbidden')
  }

  const query = getQuery(event)
  const parsed = groupApplicationsQuerySchema.safeParse(query)
  if (!parsed.success) {
    throw apiError(400, ErrorCodes.VALIDATION_FAILED, 'Invalid query parameters')
  }

  const { status, orderBy: orderByField } = parsed.data

  const orderBy = orderByField === 'status'
    ? { status: 'asc' as const }
    : { createdAt: 'desc' as const }

  const where: Record<string, unknown> = { groupId: group.id }
  if (status) where.status = status

  const applications = await prisma.application.findMany({
    where,
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
