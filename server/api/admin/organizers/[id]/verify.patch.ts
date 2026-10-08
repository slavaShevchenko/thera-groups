import { requireAuth } from '../../../../utils/auth'
import { requirePermission } from '../../../../utils/permissions'
import { organizerService } from '../../../../services/organizerService'
import { apiError } from '../../../../utils/apiError'
import { ErrorCodes } from '../../../../utils/errorCodes'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  requirePermission(user, 'admin.profiles.moderate')

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw apiError(400, ErrorCodes.VALIDATION_FAILED, 'Organizer ID is required')
  }

  // Same domain action as PATCH /api/admin/organizer-profiles/[id] with
  // verificationStatus=VERIFIED, so it delegates instead of keeping a second, silent
  // implementation: the organizer gets the in-app notification and the email either way.
  return organizerService.moderateProfile(id, 'VERIFIED', undefined, 'ORGANIZER_APPROVED')
})
