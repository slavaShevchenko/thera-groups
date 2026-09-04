import { requireAuth } from '../../utils/auth'
import { prisma } from '../../utils/prisma'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      id: true,
      email: true,
      role: true,
      preferredLocale: true,
      createdAt: true,
      organizerProfile: (user.role === 'ORGANIZER' || user.role === 'ADMIN')
        ? {
            select: {
              id: true,
              slug: true,
              firstName: true,
              lastName: true,
              avatarUrl: true,
              bio: true,
              qualification: true,
              verificationStatus: true,
            },
          }
        : false,
    },
  })

  if (!dbUser) {
    throw createError({ statusCode: 404, statusMessage: 'User not found' })
  }

  return dbUser
})
