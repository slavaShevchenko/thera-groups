import { requireAuth } from '../../utils/auth'
import { requirePermission } from '../../utils/permissions'
import { organizerRepository } from '../../repositories/organizerRepository'
import { adminOrganizersQuerySchema } from '../../validators/query'
import { apiError } from '../../utils/apiError'
import { ErrorCodes } from '../../utils/errorCodes'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  requirePermission(user, 'admin.organizers.view')

  const query = getQuery(event)
  const parsed = adminOrganizersQuerySchema.safeParse(query)
  if (!parsed.success) {
    throw apiError(400, ErrorCodes.VALIDATION_FAILED, 'Invalid query parameters')
  }

  const { page, limit } = parsed.data
  const skip = (page - 1) * limit

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
