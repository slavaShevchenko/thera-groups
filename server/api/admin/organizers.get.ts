import { requireAuth } from '../../utils/auth'
import { requirePermission } from '../../utils/permissions'
import { organizerRepository } from '../../repositories/organizerRepository'
import { parsePagination } from '../../utils/pagination'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  requirePermission(user, 'admin.organizers.view')

  const query = getQuery(event)
  const { page, limit, skip } = parsePagination(query as Record<string, unknown>)

  const { organizers, total } = await organizerRepository.findAllWithDetails({
    skip,
    take: limit,
  })

  const items = organizers.map(o => ({
    id: o.id,
    firstName: o.firstName,
    lastName: o.lastName,
    slug: o.slug,
    email: o.user.email,
    isActive: o.user.isActive,
    verificationStatus: o.verificationStatus,
    groupsCount: o._count.groups,
    createdAt: o.createdAt,
  }))

  return {
    items,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  }
})
