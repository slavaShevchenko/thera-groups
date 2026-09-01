import { requireAuth } from '../../utils/auth'
import { prisma } from '../../utils/prisma'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)

  const favorites = await prisma.favorite.findMany({
    where: {
      userId: user.id,
      group: { status: 'PUBLISHED' },
    },
    include: {
      group: {
        include: {
          organizer: {
            select: {
              firstName: true,
              lastName: true,
              avatar: true,
              avatarUrl: true,
            },
          },
          coOrganizers: {
            include: {
              user: {
                select: {
                  id: true,
                  organizerProfile: {
                    select: {
                      firstName: true,
                      lastName: true,
                      avatar: true,
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
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  return favorites.map(f => ({
    id: f.group.id,
    slug: f.group.slug,
    title: f.group.title,
    description: f.group.description,
    format: f.group.format,
    type: f.group.type,
    location: f.group.location,
    price: f.group.price,
    currency: f.group.currency,
    capacity: f.group.capacity,
    startsAt: f.group.startsAt,
    organizer: {
      firstName: f.group.organizer.firstName,
      lastName: f.group.organizer.lastName,
      avatarUrl: f.group.organizer.avatarUrl ?? f.group.organizer.avatar,
    },
    coOrganizers: f.group.coOrganizers.map(co => ({
      userId: co.userId,
      role: co.role,
      user: {
        id: co.user.id,
        organizerProfile: co.user.organizerProfile
          ? {
            firstName: co.user.organizerProfile.firstName,
            lastName: co.user.organizerProfile.lastName,
            avatarUrl: co.user.organizerProfile.avatarUrl ?? co.user.organizerProfile.avatar,
            slug: co.user.organizerProfile.slug,
          }
          : null,
      },
    })),
    applicationsCount: f.group._count.applications,
    favoritedAt: f.createdAt,
  }))
})
