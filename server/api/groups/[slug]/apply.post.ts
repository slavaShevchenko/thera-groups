import { applySchema } from '../../../validators/application'
import { applicationService } from '../../../services/applicationService'
import { useRateLimiter, applicationLimiter } from '../../../utils/rateLimit'
import { apiError } from '../../../utils/apiError'
import { ErrorCodes } from '../../../utils/errorCodes'
import { getUser } from '../../../utils/auth'
import { mapDomainError } from '../../../utils/mapDomainError'

export default defineEventHandler(async (event) => {
  await useRateLimiter(event, applicationLimiter)

  const slug = getRouterParam(event, 'slug')
  if (!slug) {
    throw apiError(400, ErrorCodes.VALIDATION_FAILED, 'Slug is required')
  }

  const body = await readBody(event)

  const parsed = applySchema.safeParse(body)
  if (!parsed.success) {
    throw apiError(400, ErrorCodes.VALIDATION_FAILED, 'Validation failed', {
      issues: parsed.error.issues.map(i => ({
        path: i.path.join('.'),
        message: i.message,
      })),
    })
  }

  const user = await getUser(event)

  try {
    return await applicationService.create(slug, parsed.data, {
      userId: user?.id,
    })
  }
  catch (error) {
    mapDomainError(error)
  }
})
