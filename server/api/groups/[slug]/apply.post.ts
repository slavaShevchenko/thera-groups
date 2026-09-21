import { z } from 'zod'
import { applySchema } from '../../../validators/application'
import { applicationService } from '../../../services/applicationService'
import { useRateLimiter, applicationLimiter } from '../../../utils/rateLimit'
import { apiError } from '../../../utils/apiError'
import { ErrorCodes } from '../../../utils/errorCodes'

export default defineEventHandler(async (event) => {
  await useRateLimiter(event, applicationLimiter)

  const slug = getRouterParam(event, 'slug')
  if (!slug) {
    throw apiError(400, ErrorCodes.VALIDATION_FAILED, 'Slug is required')
  }

  const body = await readBody(event)

  let data
  try {
    data = applySchema.parse(body)
  }
  catch (error) {
    if (error instanceof z.ZodError) {
      throw apiError(400, ErrorCodes.VALIDATION_FAILED, 'Validation failed')
    }
    throw error
  }

  return applicationService.create(slug, data)
})
