import { requireAuth } from '../../../utils/auth'
import { prisma } from '../../../utils/prisma'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const slug = getRouterParam(event, 'slug')

  const group = await prisma.group.findUnique({
    where: { slug },
    select: { id: true, status: true },
  })

  if (!group || group.status !== 'PUBLISHED') {
    throw createError({ statusCode: 404, statusMessage: 'Group not found' })
  }

  const existing = await prisma.favorite.findUnique({
    where: {
      userId_groupId: {
        userId: user.id,
        groupId: group.id,
      },
    },
  })

  if (existing) {
    throw createError({ statusCode: 409, statusMessage: 'Already in favorites' })
  }

  const favorite = await prisma.favorite.create({
    data: {
      userId: user.id,
      groupId: group.id,
    },
  })

  return { favorite: { userId: favorite.userId, groupId: favorite.groupId } }
})
