import { z } from 'zod'
import { applySchema } from '../../../validators/application'
import { applicationService } from '../../../services/applicationService'
import { applicationLimiter } from '../../../utils/rateLimit'
import { getRequestIP } from 'h3'
import { apiError } from '../../../utils/apiError'
import { ErrorCodes } from '../../../utils/errorCodes'

export default defineEventHandler(async (event) => {
  const ip = getRequestIP(event, { xForwardedFor: true }) || 'unknown'
  try {
    await applicationLimiter.consume(ip)
  }
  catch (rejRes) {
    const retrySecs = Math.round((rejRes as { msBeforeNext: number }).msBeforeNext / 1000) || 1
    throw apiError(429, ErrorCodes.RATE_LIMITED, `Too many requests. Try again in ${retrySecs} seconds.`)
  }

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
