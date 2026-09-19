import { z } from 'zod'
import { requireAuth } from '../../../../utils/auth'
import { applicationStatusSchema } from '../../../../validators/application'
import { applicationService } from '../../../../services/applicationService'
import { apiError } from '../../../../utils/apiError'
import { ErrorCodes } from '../../../../utils/errorCodes'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const slug = getRouterParam(event, 'slug')
  const applicationId = getRouterParam(event, 'id')

  if (!slug) {
    throw apiError(400, ErrorCodes.VALIDATION_FAILED, 'Slug is required')
  }

  if (!applicationId) {
    throw apiError(400, ErrorCodes.VALIDATION_FAILED, 'Application ID is required')
  }

  const body = await readBody(event)

  let data
  try {
    data = applicationStatusSchema.parse(body)
  }
  catch (error) {
    if (error instanceof z.ZodError) {
      throw apiError(400, ErrorCodes.VALIDATION_FAILED, 'Validation failed')
    }
    throw error
  }

  return applicationService.updateStatus(slug, applicationId, data.status, {
    userId: user.id,
    isAdmin: user.role === 'ADMIN',
  })
})
