import { requireAuth } from '../../../utils/auth'
import { notificationRepository } from '../../../repositories/notificationRepository'
import { apiError } from '../../../utils/apiError'
import { ErrorCodes } from '../../../utils/errorCodes'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw apiError(400, ErrorCodes.VALIDATION_FAILED, 'Notification ID is required')
  }

  await notificationRepository.markAsRead(id, user.id)

  return { success: true }
})
