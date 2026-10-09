import { z } from 'zod'
import { requireAuth } from '../../../utils/auth'
import { requirePermission } from '../../../utils/permissions'
import { groupService } from '../../../services/groupService'
import { apiError } from '../../../utils/apiError'
import { ErrorCodes } from '../../../utils/errorCodes'

const adminGroupStatusSchema = z.object({
  status: z.enum(['PUBLISHED', 'REJECTED', 'COMPLETED', 'CANCELLED']),
  rejectionReason: z.string().max(1000).optional(),
})

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  requirePermission(user, 'admin.groups.moderate')

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw apiError(400, ErrorCodes.VALIDATION_FAILED, 'Group ID is required')
  }

  const body = await readBody(event)

  let data
  try {
    data = adminGroupStatusSchema.parse(body)
  }
  catch (error) {
    if (error instanceof z.ZodError) {
      throw apiError(400, ErrorCodes.VALIDATION_FAILED, 'Validation failed')
    }
    throw error
  }

  return groupService.moderateGroup(id, data.status, data.rejectionReason)
})
