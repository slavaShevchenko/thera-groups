import { z } from 'zod'
import { requireAuth } from '../../../utils/auth'
import { requirePermission } from '../../../utils/permissions'
import { groupService } from '../../../services/groupService'

const adminGroupStatusSchema = z.object({
  status: z.enum(['PUBLISHED', 'REJECTED']),
  rejectionReason: z.string().max(1000).optional(),
})

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  requirePermission(user, 'admin.groups.moderate')

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Group ID is required' })
  }

  const body = await readBody(event)

  let data
  try {
    data = adminGroupStatusSchema.parse(body)
  }
  catch (error) {
    if (error instanceof z.ZodError) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Validation failed',
        data: { details: error.issues },
      })
    }
    throw error
  }

  return groupService.moderateGroup(id, data.status, data.rejectionReason)
})
