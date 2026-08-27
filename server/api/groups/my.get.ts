import { requireRole } from '../../utils/auth'
import { prisma } from '../../utils/prisma'

export default defineEventHandler(async (event) => {
  const user = await requireRole(event, ['ORGANIZER'])

  const profile = await prisma.organizerProfile.findUnique({
    where: { userId: user.id },
  })

  if (!profile) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Organizer profile not found',
    })
  }

  const groups = await prisma.group.findMany({
    where: { organizerId: profile.id },
    include: {
      category: true,
      _count: {
        select: { applications: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  return groups.map(g => ({
    id: g.id,
    slug: g.slug,
    title: g.title,
    status: g.status,
    format: g.format,
    type: g.type,
    startsAt: g.startsAt,
    category: g.category?.name ?? '',
    applicationsCount: g._count.applications,
    rejectionReason: g.rejectionReason,
    createdAt: g.createdAt,
  }))
})
