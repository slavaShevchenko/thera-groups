import { requireAuth } from '../../../utils/auth'
import { requirePermission } from '../../../utils/permissions'
import { organizerRepository } from '../../../repositories/organizerRepository'
import { paginationQuerySchema } from '../../../validators/query'
import { apiError } from '../../../utils/apiError'
import { ErrorCodes } from '../../../utils/errorCodes'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  requirePermission(user, 'admin.profiles.view')

  const parsed = paginationQuerySchema.safeParse(getQuery(event))
  if (!parsed.success) {
    throw apiError(400, ErrorCodes.VALIDATION_FAILED, 'Invalid query parameters')
  }

  const { page, limit } = parsed.data
  const skip = (page - 1) * limit

  const { profiles, total } = await organizerRepository.findPendingVerification({
    skip,
    take: limit,
  })

  return {
    items: profiles.map(p => ({
      id: p.id,
      slug: p.slug,
      firstName: p.firstName,
      lastName: p.lastName,
      email: p.user.email,
      bio: p.bio,
      qualification: p.qualification,
      avatarUrl: p.avatarUrl,
      city: p.city,
      experienceYears: p.experienceYears,
      specializations: p.specializations,
      createdAt: p.createdAt,
    })),
    total,
    page,
    totalPages: Math.ceil(total / limit),
  }
})
