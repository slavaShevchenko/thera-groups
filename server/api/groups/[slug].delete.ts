import { requireAuth } from '../../utils/auth'
import { prisma } from '../../utils/prisma'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const slug = getRouterParam(event, 'slug')

  if (!slug) {
    throw createError({ statusCode: 400, statusMessage: 'Slug is required' })
  }

  const group = await prisma.group.findUnique({
    where: { slug },
    include: { organizer: true },
  })

  if (!group) {
    throw createError({ statusCode: 404, statusMessage: 'Group not found' })
  }

  if (group.organizer.userId !== user.id && user.role !== 'ADMIN') {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }

  if (group.status !== 'DRAFT') {
    throw createError({
      statusCode: 400,
      statusMessage: 'Only draft groups can be deleted',
    })
  }

  await prisma.group.delete({ where: { id: group.id } })

  return { success: true }
})
