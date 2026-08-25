import { requireAuth } from '../../../../utils/auth'
import { prisma } from '../../../../utils/prisma'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const slug = getRouterParam(event, 'slug')
  const id = getRouterParam(event, 'id')
  if (!slug || !id) throw createError({ statusCode: 400, statusMessage: 'Missing params' })

  const group = await prisma.group.findUnique({
    where: { slug },
    include: { organizer: true },
  })
  if (!group) throw createError({ statusCode: 404, statusMessage: 'Group not found' })
  if (group.organizer.userId !== user.id && user.role !== 'ADMIN') {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }

  const question = await prisma.applicationQuestion.findUnique({ where: { id } })
  if (!question || question.groupId !== group.id) {
    throw createError({ statusCode: 404, statusMessage: 'Question not found' })
  }

  await prisma.applicationQuestion.delete({ where: { id } })

  // Пересчёт позиций оставшихся
  const remaining = await prisma.applicationQuestion.findMany({
    where: { groupId: group.id },
    orderBy: { position: 'asc' },
  })
  for (let i = 0; i < remaining.length; i++) {
    if (remaining[i].position !== i) {
      await prisma.applicationQuestion.update({
        where: { id: remaining[i].id },
        data: { position: i },
      })
    }
  }

  return { success: true }
})
