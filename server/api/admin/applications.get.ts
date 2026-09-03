import { requireRole } from '../../utils/auth'
import { prisma } from '../../utils/prisma'

export default defineEventHandler(async (event) => {
  await requireRole(event, ['ADMIN'])

  const query = getQuery(event)
  const status = query.status as string | undefined
  const groupId = query.groupId as string | undefined
  const page = Math.max(1, Number(query.page) || 1)
  const pageSize = Math.min(100, Math.max(1, Number(query.pageSize) || 50))

  const where: Record<string, unknown> = {}

  if (status && status !== 'ALL') {
    where.status = status
  }

  if (groupId) {
    where.groupId = groupId
  }

  const [applications, total, stats] = await Promise.all([
    prisma.application.findMany({
      where,
      include: {
        group: { select: { id: true, title: true, slug: true } },
        answers: {
          include: {
            question: { select: { question: true, type: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.application.count({ where }),
    prisma.application.groupBy({
      by: ['status'],
      where,
      _count: true,
    }),
  ])

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const weekAgo = new Date(today)
  weekAgo.setDate(weekAgo.getDate() - 7)

  const [todayCount, weekCount] = await Promise.all([
    prisma.application.count({ where: { ...where, createdAt: { gte: today } } }),
    prisma.application.count({ where: { ...where, createdAt: { gte: weekAgo } } }),
  ])

  const statusCounts: Record<string, number> = {}
  for (const s of stats) {
    statusCounts[s.status] = s._count
  }

  return {
    applications: applications.map(a => ({
      id: a.id,
      name: a.name,
      email: a.email,
      phone: a.phone,
      message: a.message,
      status: a.status,
      createdAt: a.createdAt,
      group: a.group,
      answers: a.answers.map(ans => ({
        question: ans.question.question,
        type: ans.question.type,
        value: ans.value,
      })),
    })),
    total,
    page,
    pageSize,
    stats: {
      total: total,
      today: todayCount,
      week: weekCount,
      pending: statusCounts.PENDING || 0,
      approved: statusCounts.APPROVED || 0,
      rejected: statusCounts.REJECTED || 0,
      withdrawn: statusCounts.WITHDRAWN || 0,
    },
  }
})
