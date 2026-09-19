import { requireAuth } from '../../utils/auth'
import { requirePermission } from '../../utils/permissions'
import { userRepository } from '../../repositories/userRepository'
import { adminUsersQuerySchema } from '../../validators/query'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  requirePermission(user, 'admin.users.view')

  const query = getQuery(event)
  const parsed = adminUsersQuerySchema.safeParse(query)
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid query parameters' })
  }

  const { page, limit } = parsed.data
  const skip = (page - 1) * limit

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
