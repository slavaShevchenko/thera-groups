import { organizerRepository } from '../../repositories/organizerRepository'
import { organizersQuerySchema } from '../../validators/query'
import { apiError } from '../../utils/apiError'
import { ErrorCodes } from '../../utils/errorCodes'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const parsed = organizersQuerySchema.safeParse(query)
  if (!parsed.success) {
    throw apiError(400, ErrorCodes.VALIDATION_FAILED, 'Invalid query parameters')
  }

  const { page, limit, q, city, format } = parsed.data
  const skip = (page - 1) * limit

  const [organizers, total] = await Promise.all([
    organizerRepository.findVerifiedOrganizers({ q, city, format, skip, take: limit }),
    organizerRepository.countVerifiedOrganizers({ q, city, format }),
  ])

  return {
    organizers: organizers.map(o => ({
      id: o.id,
      firstName: o.firstName,
      lastName: o.lastName,
      slug: o.slug,
      avatarUrl: o.avatarUrl,
      city: o.city,
      experienceYears: o.experienceYears,
      specializations: o.specializations,
      groupsCount: o._count.groups,
    })),
    total,
    page,
    totalPages: Math.ceil(total / limit),
  }
})
