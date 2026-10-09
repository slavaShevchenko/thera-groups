import { requireAuth } from '../../utils/auth'
import { groupService } from '../../services/groupService'
import { apiError } from '../../utils/apiError'
import { ErrorCodes } from '../../utils/errorCodes'
import { findDomainError, mapDomainError } from '../../utils/mapDomainError'
import { mapPrismaError } from '../../utils/errorHandler'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const slug = getRouterParam(event, 'slug')

  if (!slug) {
    throw apiError(400, ErrorCodes.VALIDATION_FAILED, 'Slug is required')
  }

  try {
    return await groupService.deleteGroup(slug, { userId: user.id, role: user.role })
  }
  catch (error) {
    if (error && typeof error === 'object' && 'statusCode' in error) throw error
    // Ownership, status and the "applicants are waiting" refusal are domain errors with
    // their own trusted codes. `mapPrismaError` would sanitize those to a 500 INTERNAL,
    // so they are mapped first and only a driver failure falls through to it.
    if (findDomainError(error)) mapDomainError(error)
    throw mapPrismaError(error, 'groups.delete')
  }
})
