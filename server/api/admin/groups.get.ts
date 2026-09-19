import { requireAuth } from '../../utils/auth'
import { requirePermission } from '../../utils/permissions'
import { groupRepository } from '../../repositories/groupRepository'
import { adminGroupsQuerySchema } from '../../validators/query'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  requirePermission(user, 'admin.groups.moderate')

  const query = getQuery(event)
  const parsed = adminGroupsQuerySchema.safeParse(query)
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid query parameters' })
  }

  const { page, limit, status } = parsed.data
  const skip = (page - 1) * limit

  const where: Record<string, unknown> = {}
  if (status) where.status = status

  const { groups, total } = await groupRepository.findAllAdmin({
    where,
    skip,
    take: limit,
  })

  const items = groups.map(g => ({
    id: g.id,
    slug: g.slug,
    title: g.title,
    status: g.status,
    type: g.type,
    format: g.format,
    startsAt: g.startsAt,
    rejectionReason: g.rejectionReason,
    organizer: {
      id: g.organizer.id,
      name: `${g.organizer.firstName} ${g.organizer.lastName}`,
      slug: g.organizer.slug,
      avatarUrl: g.organizer.avatarUrl,
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
  }))

  return {
    items,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  }
})
