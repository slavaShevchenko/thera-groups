import { z } from 'zod'
import { requireAuth } from '../../utils/auth'
import { updateGroupSchema } from '../../validators/group'
import { groupService } from '../../services/groupService'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const slug = getRouterParam(event, 'slug')

  if (!slug) {
    throw createError({ statusCode: 400, statusMessage: 'Slug is required' })
  }

  const body = await readBody(event)

  let data
  try {
    data = updateGroupSchema.parse(body)
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

  return groupService.updateGroup(slug, data, {
    userId: user.id,
    role: user.role,
    isAdmin: user.role === 'ADMIN',
    organizerId: user.role === 'ADMIN' ? (body as Record<string, unknown>).organizerId as string : undefined,
  })
})
