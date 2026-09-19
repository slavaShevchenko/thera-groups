import { z } from 'zod'
import { applySchema } from '../../../validators/application'
import { applicationService } from '../../../services/applicationService'

export default defineEventHandler(async (event) => {
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
