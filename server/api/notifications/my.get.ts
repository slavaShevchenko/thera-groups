import { requireAuth } from '../../utils/auth'
import { prisma } from '../../utils/prisma'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)

  const notifications = await prisma.notification.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })

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
