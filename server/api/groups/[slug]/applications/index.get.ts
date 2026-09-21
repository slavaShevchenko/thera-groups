import { requireAuth } from '../../../../utils/auth'
import { groupRepository } from '../../../../repositories/groupRepository'
import { applicationRepository } from '../../../../repositories/applicationRepository'
import { groupApplicationsQuerySchema } from '../../../../validators/query'
import { apiError } from '../../../../utils/apiError'
import { ErrorCodes } from '../../../../utils/errorCodes'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const slug = getRouterParam(event, 'slug')
  if (!slug) {
    throw apiError(400, ErrorCodes.VALIDATION_FAILED, 'Group slug is required')
  }

  const group = await groupRepository.findWithCoOrganizers(slug)

  if (!group) {
    throw apiError(404, ErrorCodes.NOT_FOUND, 'Group not found')
  }

  const isOwner = group.organizer.userId === user.id
  const isCoOrganizer = group.coOrganizers.some(c => c.userId === user.id)
  if (!isOwner && user.role !== 'ADMIN' && !isCoOrganizer) {
    throw apiError(403, ErrorCodes.FORBIDDEN, 'Forbidden')
  }

  const query = getQuery(event)
  const parsed = groupApplicationsQuerySchema.safeParse(query)
  if (!parsed.success) {
    throw apiError(400, ErrorCodes.VALIDATION_FAILED, 'Invalid query parameters')
  }

  const { status, orderBy: orderByField, page, limit } = parsed.data
  const skip = (page - 1) * limit

  const orderBy = orderByField === 'status'
    ? { status: 'asc' as const }
    : { createdAt: 'desc' as const }

  const applications = await applicationRepository.findGroupApplications(group.id, {
    status,
    orderBy,
    take: limit,
    skip,
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
    page,
    pageSize: limit,
  }
})
