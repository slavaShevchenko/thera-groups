import { requireAuth } from '../../../utils/auth'
import { notificationRepository } from '../../../repositories/notificationRepository'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Notification ID is required' })
  }

  await notificationRepository.markAsRead(id, user.id)

  return { success: true }
})
