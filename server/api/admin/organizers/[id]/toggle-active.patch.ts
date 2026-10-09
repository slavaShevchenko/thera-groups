import { requireAuth } from '../../../../utils/auth'
import { requirePermission } from '../../../../utils/permissions'
import { organizerService } from '../../../../services/organizerService'
import { apiError } from '../../../../utils/apiError'
import { ErrorCodes } from '../../../../utils/errorCodes'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  requirePermission(user, 'admin.organizers.moderate')

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw apiError(400, ErrorCodes.VALIDATION_FAILED, 'Organizer ID is required')
  }

  return organizerService.toggleActive(id)
})
