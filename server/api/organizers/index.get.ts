import { getUser } from '../../utils/auth'
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

  const [rows, total, caller] = await Promise.all([
    organizerRepository.findVerifiedOrganizers({ q, city, format, skip, take: limit }),
    organizerRepository.countVerifiedOrganizers({ q, city, format }),
    // Read, not required: the catalog is public and must stay reachable anonymously.
    getUser(event),
  ])

  // The profile cuid is handed to an admin alone, because that is the only caller who can
  // act on it: `POST /api/groups` takes `organizerId` as a profile id, and the admin
  // "create on behalf of" picker reads it from here. Everybody else identifies an organizer
  // by slug — the same rule `organizers/[slug].get.ts` already follows, where the cuid was
  // reachable by any anonymous visitor for no reason.
  const maySeeProfileId = caller?.role === 'ADMIN'

  return {
    organizers: rows.map(o => ({
      ...(maySeeProfileId ? { id: o.id } : {}),
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
