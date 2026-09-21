import { requireAuth } from '../../utils/auth'
import { notificationRepository } from '../../repositories/notificationRepository'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const count = await notificationRepository.countUnread(user.id)
  return { count }
})
