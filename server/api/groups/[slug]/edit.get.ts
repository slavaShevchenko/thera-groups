import { requireAuth } from '../../../utils/auth'
import { groupRepository } from '../../../repositories/groupRepository'
import { apiError } from '../../../utils/apiError'
import { ErrorCodes } from '../../../utils/errorCodes'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const slug = getRouterParam(event, 'slug')

  if (!slug) {
    throw apiError(400, ErrorCodes.VALIDATION_FAILED, 'Slug is required')
  }

  const group = await groupRepository.findBySlugForEdit(slug)

  if (!group || !group.organizer) {
    throw apiError(404, ErrorCodes.NOT_FOUND, 'Group not found')
  }

  const isOwner = group.organizer.userId === user.id
  const isAdmin = user.role === 'ADMIN'
  const isCoOrganizer = group.coOrganizers.some(c => c.userId === user.id)

  if (!isOwner && !isAdmin && !isCoOrganizer) {
    throw apiError(404, ErrorCodes.NOT_FOUND, 'Group not found')
  }

  return {
    id: group.id,
    slug: group.slug,
    organizerUserId: group.organizer.userId,
    // An admin picks the owner on /groups/new and the edit page has to show who that was,
    // so the display name travels with the id. `include: { organizer: true }` already loaded
    // it — no extra query. Joined here rather than sent as two fields because the only
    // consumer renders it as one read-only label.
    organizerName: `${group.organizer.firstName} ${group.organizer.lastName}`.trim(),
    title: group.title,
    description: group.description,
    program: group.program,
    status: group.status,
    format: group.format,
    type: group.type,
    location: group.location,
    languages: group.languages,
    startsAt: group.startsAt,
    endsAt: group.endsAt,
    timezone: group.timezone,
    capacity: group.capacity,
    minParticipants: group.minParticipants,
    durationHours: group.durationHours,
    certificateIssued: group.certificateIssued,
    priceAmount: group.priceAmount != null ? Number(group.priceAmount) : null,
    currency: group.currency,
    tags: group.tags.map(t => ({ id: t.id, name: t.name, slug: t.slug })),
    questions: group.questions.map(q => ({
      id: q.id,
      question: q.question,
      type: q.type,
      required: q.required,
      position: q.position,
      options: q.options,
    })),
    rejectionReason: group.rejectionReason,
    applicationsCount: group._count.applications,
    coOrganizers: group.coOrganizers.map(co => ({
      userId: co.userId,
      role: co.role,
      sortOrder: co.sortOrder,
      user: {
        firstName: co.user.organizerProfile?.firstName ?? '',
        lastName: co.user.organizerProfile?.lastName ?? '',
        avatarUrl: co.user.organizerProfile?.avatarUrl ?? null,
        slug: co.user.organizerProfile?.slug ?? null,
      },
    })),
    createdAt: group.createdAt,
  }
})
