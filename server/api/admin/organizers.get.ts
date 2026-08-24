import { requireRole } from '../../utils/auth'
import { prisma } from '../../utils/prisma'

export default defineEventHandler(async (event) => {
  await requireRole(event, ['ADMIN'])

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
    email: o.user.email,
    isActive: o.user.isActive,
    verificationStatus: o.verificationStatus,
    groupsCount: o._count.groups,
    createdAt: o.createdAt,
  }))
})
