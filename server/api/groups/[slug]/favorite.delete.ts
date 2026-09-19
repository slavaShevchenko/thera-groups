import { requireAuth } from '../../../utils/auth'
import { prisma } from '../../../utils/prisma'
import { apiError } from '../../../utils/apiError'
import { ErrorCodes } from '../../../utils/errorCodes'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const slug = getRouterParam(event, 'slug')

  const group = await prisma.group.findUnique({
    where: { slug },
    select: { id: true },
  })

  if (!group) {
    throw apiError(404, ErrorCodes.NOT_FOUND, 'Group not found')
  }

  const existing = await prisma.favorite.findUnique({
    where: {
      userId_groupId: {
        userId: user.id,
        groupId: group.id,
      },
    },
  })

  if (!existing) {
    throw apiError(404, ErrorCodes.NOT_FOUND, 'Not in favorites')
  }

  await prisma.favorite.delete({
    where: {
      userId_groupId: {
        userId: user.id,
        groupId: group.id,
      },
    },
  })

  return { success: true }
})
