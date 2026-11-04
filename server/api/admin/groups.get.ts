import { requireAuth } from '../../utils/auth'
import { requirePermission } from '../../utils/permissions'
import { groupRepository } from '../../repositories/groupRepository'
import { adminGroupsQuerySchema } from '../../validators/query'
import { apiError } from '../../utils/apiError'
import { ErrorCodes } from '../../utils/errorCodes'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  requirePermission(user, 'admin.groups.view')

  const query = getQuery(event)
  const parsed = adminGroupsQuerySchema.safeParse(query)
  if (!parsed.success) {
    throw apiError(400, ErrorCodes.VALIDATION_FAILED, 'Invalid query parameters')
  }

  const { page, limit, status } = parsed.data
  const skip = (page - 1) * limit

  const where: Record<string, unknown> = {}
  if (status?.length) where.status = { in: status }

  const { groups, total } = await groupRepository.findAllAdmin({
    where,
    skip,
    take: limit,
  })

  // `Group.organizerId` is nullable and its foreign key is `ON DELETE SET NULL`, so a group
  // can outlive its organizer. Those rows are dropped rather than rendered with a blank
  // owner, and the drop is an explicit guard: the non-null assertions this replaces are
  // what would turn the first organizer-less row into a 500.
  const items = groups.flatMap((g) => {
    const organizer = g.organizer
    if (!organizer) return []

    return [{
      id: g.id,
      slug: g.slug,
      title: g.title,
      status: g.status,
      type: g.type,
      format: g.format,
      startsAt: g.startsAt,
      rejectionReason: g.rejectionReason,
      organizer: {
        id: organizer.id,
        name: `${organizer.firstName} ${organizer.lastName}`,
        slug: organizer.slug,
        avatarUrl: organizer.avatarUrl,
      },
      coOrganizers: g.coOrganizers.map(co => ({
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
      createdAt: g.createdAt,
      updatedAt: g.updatedAt,
    }]
  })

  return {
    items,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  }
})
