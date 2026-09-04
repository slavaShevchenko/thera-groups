import { requireAuth } from '../../utils/auth'
import { requirePermission } from '../../utils/permissions'
import { prisma } from '../../utils/prisma'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  requirePermission(user, 'admin.users.view')

  const users = await prisma.user.findMany({
    where: {
      role: 'VISITOR',
    },
    orderBy: {
      createdAt: 'desc',
    },
  })

  return users.map(u => ({
    id: u.id,
    email: u.email,
    role: u.role,
    isActive: u.isActive,
    createdAt: u.createdAt,
  }))
})
