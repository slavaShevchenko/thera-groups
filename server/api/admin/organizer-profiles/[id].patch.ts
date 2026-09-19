import { z } from 'zod'
import { requireAuth } from '../../../utils/auth'
import { requirePermission } from '../../../utils/permissions'
import { organizerService } from '../../../services/organizerService'
import { apiError } from '../../../utils/apiError'
import { ErrorCodes } from '../../../utils/errorCodes'

const schema = z.object({
  verificationStatus: z.enum(['VERIFIED', 'REJECTED']),
  rejectionReason: z.string().max(1000).optional(),
})

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  requirePermission(user, 'admin.profiles.moderate')

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw apiError(400, ErrorCodes.VALIDATION_FAILED, 'Profile ID is required')
  }

  const body = await readBody(event)
  let data
  try {
    data = schema.parse(body)
  }
  catch (error) {
    if (error instanceof z.ZodError) {
      throw apiError(400, ErrorCodes.VALIDATION_FAILED, 'Validation failed', { details: error.issues })
    }
    throw error
  }

  const notificationType = data.verificationStatus === 'VERIFIED' ? 'ORGANIZER_APPROVED' : 'ORGANIZER_REJECTED'

  return organizerService.moderateProfile(
    id,
    data.verificationStatus,
    data.rejectionReason,
    notificationType,
  )
})
