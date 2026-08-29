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
      coOrganizers: {
        include: {
          user: {
            select: {
              id: true,
              organizerProfile: {
                select: {
                  firstName: true,
                  lastName: true,
                  avatarUrl: true,
                  slug: true,
                },
              },
            },
          },
        },
      },
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
    applicationsCount: g._count.applications,
    rejectionReason: g.rejectionReason,
    coOrganizers: g.coOrganizers.map(co => ({
      userId: co.userId,
      role: co.role,
      sortOrder: co.sortOrder,
      user: {
        firstName: co.user.organizerProfile?.firstName ?? '',
        lastName: co.user.organizerProfile?.lastName ?? '',
        avatarUrl: co.user.organizerProfile?.avatarUrl ?? null,
        slug: co.user.organizerProfile?.slug ?? null,
      },
    })),
    createdAt: g.createdAt,
  }))
})
