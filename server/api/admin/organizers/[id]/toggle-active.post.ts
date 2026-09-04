import { requireAuth } from '../../../../utils/auth'
import { requirePermission } from '../../../../utils/permissions'
import { prisma } from '../../../../utils/prisma'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  requirePermission(user, 'admin.organizers.view')

  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Organizer ID is required',
    })
  }

  const organizer = await prisma.organizerProfile.findUnique({
    where: { id },
    include: { user: true },
  })

  if (!organizer) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Organizer not found',
    })
  }

  const updated = await prisma.user.update({
    where: { id: organizer.userId },
    data: { isActive: !organizer.user.isActive },
  })

  return {
    id: organizer.id,
    isActive: updated.isActive,
  }
})
