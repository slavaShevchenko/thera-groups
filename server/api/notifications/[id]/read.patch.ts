import { requireAuth } from '../../../utils/auth'
import { prisma } from '../../../utils/prisma'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Notification ID is required' })
  }

  const notification = await prisma.notification.findFirst({
    where: { id, userId: user.id },
  })

  if (!notification) {
    throw createError({ statusCode: 404, statusMessage: 'Notification not found' })
  }

  await prisma.notification.update({
    where: { id },
    data: { readAt: new Date() },
  })

  return { success: true }
})
