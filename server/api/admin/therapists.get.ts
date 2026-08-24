import { requireRole } from '../../utils/auth'
import { prisma } from '../../utils/prisma'

export default defineEventHandler(async (event) => {
  await requireRole(event, ['ADMIN'])

  const therapists = await prisma.therapistProfile.findMany({
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

  return therapists.map(t => ({
    id: t.id,
    firstName: t.firstName,
    lastName: t.lastName,
    email: t.user.email,
    isActive: t.user.isActive,
    verificationStatus: t.verificationStatus,
    groupsCount: t._count.groups,
    createdAt: t.createdAt,
  }))
})
