import { requireAuth } from '../../utils/auth'
import { requirePermission } from '../../utils/permissions'
import { prisma } from '../../utils/prisma'
import { parsePagination } from '../../utils/pagination'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  requirePermission(user, 'admin.groups.moderate')

  const query = getQuery(event)
  const status = typeof query.status === 'string' ? query.status : undefined
  const { page, limit, skip } = parsePagination(query as Record<string, unknown>)

  const where: Record<string, unknown> = {}
  if (status) where.status = status

  const [groups, total] = await Promise.all([
    prisma.group.findMany({
      where,
      include: {
        organizer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            slug: true,
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
                    avatarUrl: true,
                    slug: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
      skip,
      take: limit,
    }),
    prisma.group.count({ where }),
  ])

  const items = groups.map(g => ({
    id: g.id,
    slug: g.slug,
    title: g.title,
    status: g.status,
    type: g.type,
    format: g.format,
    startsAt: g.startsAt,
    rejectionReason: g.rejectionReason,
    organizer: {
      id: g.organizer.id,
      name: `${g.organizer.firstName} ${g.organizer.lastName}`,
      slug: g.organizer.slug,
      avatarUrl: g.organizer.avatarUrl,
    },
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
    updatedAt: g.updatedAt,
  }))

  return {
    items,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  }
})
