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

  const parsed = updateGroupSchema.safeParse(body)
  if (!parsed.success) {
    throw apiError(400, ErrorCodes.VALIDATION_FAILED, 'Validation failed', {
      issues: parsed.error.issues.map(i => ({
        path: i.path.join('.'),
        message: i.message,
      })),
    })
  }

  try {
    return await groupService.updateGroup(slug, parsed.data, {
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
