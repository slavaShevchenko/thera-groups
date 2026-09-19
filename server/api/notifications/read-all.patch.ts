import { requireAuth } from '../../utils/auth'
import { notificationRepository } from '../../repositories/notificationRepository'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)

  const result = await notificationRepository.markAllAsRead(user.id)

  return { success: true, count: result.count }
})
