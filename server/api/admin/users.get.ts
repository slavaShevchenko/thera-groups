import { requireAuth } from '../../utils/auth'
import { requirePermission } from '../../utils/permissions'
import { userRepository } from '../../repositories/userRepository'
import { parsePagination } from '../../utils/pagination'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  requirePermission(user, 'admin.users.view')

  const query = getQuery(event)
  const { page, limit, skip } = parsePagination(query as Record<string, unknown>)

  const { users, total } = await userRepository.findAll({
    role: 'VISITOR',
    skip,
    take: limit,
  })

  const items = users.map(u => ({
    id: u.id,
    email: u.email,
    role: u.role,
    isActive: u.isActive,
    createdAt: u.createdAt,
  }))

  return {
    items,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  }
})
