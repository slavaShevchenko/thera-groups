import { prisma } from '../../utils/prisma'
import { requireAuth } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)

  const applications = await prisma.application.findMany({
    where: {
      email: user.email,
    },
    include: {
      group: {
        select: {
          title: true,
          slug: true,
          startsAt: true,
        },
      },
      _count: {
        select: { answers: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  return {
    applications: applications.map(a => ({
      id: a.id,
      groupId: a.groupId,
      name: a.name,
      email: a.email,
      status: a.status,
      createdAt: a.createdAt,
      group: a.group,
      answersCount: a._count.answers,
    })),
  }
})
