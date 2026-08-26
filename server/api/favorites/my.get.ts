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
          category: true,
          organizer: {
            select: {
              firstName: true,
              lastName: true,
              avatar: true,
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
    category: f.group.category,
    organizer: f.group.organizer,
    applicationsCount: f.group._count.applications,
    favoritedAt: f.createdAt,
  }))
})
