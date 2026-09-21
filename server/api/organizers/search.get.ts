import { requireAuth } from '../../utils/auth'
import { organizerRepository } from '../../repositories/organizerRepository'
import { organizerSearchQuerySchema } from '../../validators/query'
import { apiError } from '../../utils/apiError'
import { ErrorCodes } from '../../utils/errorCodes'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)

  if (user.role !== 'ORGANIZER' && user.role !== 'ADMIN') {
    throw apiError(403, ErrorCodes.FORBIDDEN, 'Forbidden')
  }

  const query = getQuery(event)
  const parsed = organizerSearchQuerySchema.safeParse(query)
  if (!parsed.success) {
    throw apiError(400, ErrorCodes.VALIDATION_FAILED, 'Invalid query parameters')
  }

  const q = parsed.data.q
  const excludeIds = parsed.data.exclude
    ? parsed.data.exclude.split(',').map(id => id.trim()).filter(Boolean)
    : []

  const users = await organizerRepository.searchUsers(q, excludeIds)

  return users.map(u => ({
    id: u.id,
    firstName: u.organizerProfile?.firstName ?? '',
    lastName: u.organizerProfile?.lastName ?? '',
    avatarUrl: u.organizerProfile?.avatarUrl ?? null,
    slug: u.organizerProfile?.slug ?? null,
  }))
})
