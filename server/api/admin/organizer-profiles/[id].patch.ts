import { z } from 'zod'
import { requireAuth } from '../../../utils/auth'
import { requirePermission } from '../../../utils/permissions'
import { organizerService } from '../../../services/organizerService'

const schema = z.object({
  verificationStatus: z.enum(['VERIFIED', 'REJECTED']),
  rejectionReason: z.string().max(1000).optional(),
})

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  requirePermission(user, 'admin.profiles.moderate')

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Profile ID is required' })
  }

  const body = await readBody(event)
  let data
  try {
    data = schema.parse(body)
  }
  catch (error) {
    if (error instanceof z.ZodError) {
      throw createError({ statusCode: 400, statusMessage: 'Validation failed', data: { details: error.issues } })
    }
    throw error
  }

  const notificationType = data.verificationStatus === 'VERIFIED' ? 'GROUP_APPROVED' : 'GROUP_REJECTED'

  return organizerService.moderateProfile(
    id,
    data.verificationStatus,
    data.rejectionReason,
    notificationType,
  )
})
