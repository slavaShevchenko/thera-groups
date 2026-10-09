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
      // Taken from the parsed payload, not from the raw body: the schema is what bounds its
      // length and guarantees it is a string. Still dropped for a non-admin, who has no
      // business moving somebody else's group.
      organizerId: user.role === 'ADMIN' ? parsed.data.organizerId : undefined,
    })
  }
  catch (error) {
    mapDomainError(error)
  }
})
