import { z } from 'zod'
import { requireAuth } from '../../utils/auth'
import { updateGroupSchema } from '../../validators/group'
import { groupService } from '../../services/groupService'
import { mapDomainError } from '../../utils/mapDomainError'
import { apiError } from '../../utils/apiError'
import { ErrorCodes } from '../../utils/errorCodes'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const slug = getRouterParam(event, 'slug')

  if (!slug) {
    throw apiError(400, ErrorCodes.VALIDATION_FAILED, 'Slug is required')
  }

  const body = await readBody(event)

  let data
  try {
    data = updateGroupSchema.parse(body)
  }
  catch (error) {
    if (error instanceof z.ZodError) {
      throw apiError(400, ErrorCodes.VALIDATION_FAILED, 'Validation failed')
    }
    throw error
  }

  try {
    return await groupService.updateGroup(slug, data, {
      userId: user.id,
      role: user.role,
      isAdmin: user.role === 'ADMIN',
      organizerId: user.role === 'ADMIN' ? (body as Record<string, unknown>).organizerId as string : undefined,
    })
  }
  catch (error) {
    mapDomainError(error)
  }
})
