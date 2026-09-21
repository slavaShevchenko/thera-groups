import { applicationRepository } from '../../../repositories/applicationRepository'
import { apiError } from '../../../utils/apiError'
import { ErrorCodes } from '../../../utils/errorCodes'

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug')
  if (!slug) {
    throw apiError(400, ErrorCodes.VALIDATION_FAILED, 'Group slug is required')
  }

  const group = await applicationRepository.findGroupQuestionsPublished(slug)

  if (!group || group.status !== 'PUBLISHED') {
    throw apiError(404, ErrorCodes.NOT_FOUND, 'Group not found')
  }

  return group.questions
})
