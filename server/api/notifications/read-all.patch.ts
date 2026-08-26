import { requireAuth } from '../../utils/auth'
import { prisma } from '../../utils/prisma'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)

  const result = await prisma.notification.updateMany({
    where: {
      userId: user.id,
      readAt: null,
    },
    data: { readAt: new Date() },
  })

  return { success: true, count: result.count }
})
