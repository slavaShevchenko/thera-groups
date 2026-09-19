import { requireAuth } from '../../utils/auth'
import { notificationRepository } from '../../repositories/notificationRepository'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)

  const notifications = await notificationRepository.findByUser(user.id)

  return notifications.map(n => ({
    id: n.id,
    type: n.type,
    entityType: n.entityType,
    entityId: n.entityId,
    title: n.title,
    message: n.message,
    read: n.readAt !== null,
    createdAt: n.createdAt,
  }))
})
