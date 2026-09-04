import { requireAuth } from '../../utils/auth'
import { requirePermission } from '../../utils/permissions'
import { prisma } from '../../utils/prisma'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  requirePermission(user, 'admin.organizers.view')

  const organizers = await prisma.organizerProfile.findMany({
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
    orderBy: {
      createdAt: 'desc',
    },
  })

  return organizers.map(o => ({
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
})
