import { requireAuth } from '../../utils/auth'
import { requirePermission } from '../../utils/permissions'
import { prisma } from '../../utils/prisma'
import { parsePagination } from '../../utils/pagination'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  requirePermission(user, 'admin.organizers.view')

  const query = getQuery(event)
  const { page, limit, skip } = parsePagination(query as Record<string, unknown>)

  const [organizers, total] = await Promise.all([
    prisma.organizerProfile.findMany({
      include: {
        user: {
          select: {
            email: true,
            isActive: true,
          },
        },
        _count: {
          select: { groups: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.organizerProfile.count(),
  ])

  const items = organizers.map(o => ({
    id: o.id,
    firstName: o.firstName,
    lastName: o.lastName,
    slug: o.slug,
    email: o.user.email,
    isActive: o.user.isActive,
    verificationStatus: o.verificationStatus,
    groupsCount: o._count.groups,
    createdAt: o.createdAt,
  }))

  return {
    items,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  }
})
