import { requireAuth } from '../../../utils/auth'
import { applicationService } from '../../../services/applicationService'
import { mapDomainError } from '../../../utils/mapDomainError'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Application ID is required',
      data: { code: 'VALIDATION_FAILED' },
    })
  }

  try {
    return await applicationService.withdraw(id, user.id)
  }
  catch (error) {
    return mapDomainError(error)
  }
})
