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

  if (!group || !group.organizer) {
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

  // Counted over the whole group, not the filtered page: it is the seat tally the organizer
  // reads against `capacity`, so a PENDING-only view must not make it look like nobody was
  // approved.
  const approvedCount = await applicationRepository.countApproved(group.id)

  return {
    // The managing page never fetched the group itself, so it could not say which group it
    // was listing, how many places it has, or how many are taken — approving past capacity
    // was only discoverable by hitting the 409.
    group: {
      slug: group.slug,
      title: group.title,
      status: group.status,
      capacity: group.capacity,
      approvedCount,
    },
    applications: applications.map(a => ({
      id: a.id,
      name: a.name,
      email: a.email,
      phone: a.phone,
      status: a.status,
      // Shown in the queue next to a REJECTED row, so the organizer can see what the
      // applicant was told without opening the letter. Null on every other status —
      // `applicationService.updateStatus` clears it when a decision is reverted.
      rejectionReason: a.rejectionReason,
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
