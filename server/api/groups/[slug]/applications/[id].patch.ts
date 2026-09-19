import { z } from 'zod'
import { requireAuth } from '../../../../utils/auth'
import { applicationStatusSchema } from '../../../../validators/application'
import { applicationService } from '../../../../services/applicationService'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const slug = getRouterParam(event, 'slug')
  const applicationId = getRouterParam(event, 'id')

  if (!slug) {
    throw createError({ statusCode: 400, statusMessage: 'Slug is required' })
  }

  if (!applicationId) {
    throw createError({ statusCode: 400, statusMessage: 'Application ID is required' })
  }

  const body = await readBody(event)

  let data
  try {
    data = applicationStatusSchema.parse(body)
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

  return applicationService.updateStatus(slug, applicationId, data.status, {
    userId: user.id,
    isAdmin: user.role === 'ADMIN',
  })
})
