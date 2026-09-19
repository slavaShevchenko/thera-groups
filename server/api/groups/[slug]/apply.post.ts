import { z } from 'zod'
import { applySchema } from '../../../validators/application'
import { applicationService } from '../../../services/applicationService'
import { applicationLimiter } from '../../../utils/rateLimit'
import { getRequestIP } from 'h3'

export default defineEventHandler(async (event) => {
  const ip = getRequestIP(event, { xForwardedFor: true }) || 'unknown'
  try {
    await applicationLimiter.consume(ip)
  }
  catch (rejRes) {
    const retrySecs = Math.round((rejRes as { msBeforeNext: number }).msBeforeNext / 1000) || 1
    throw createError({
      statusCode: 429,
      statusMessage: `Too many requests. Try again in ${retrySecs} seconds.`,
    })
  }

  const slug = getRouterParam(event, 'slug')
  if (!slug) {
    throw createError({ statusCode: 400, statusMessage: 'Slug is required' })
  }

  const body = await readBody(event)

  let data
  try {
    data = applySchema.parse(body)
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

  return applicationService.create(slug, data)
})
