import { requireAuth } from '../../utils/auth'
import { userRepository } from '../../repositories/userRepository'
import { apiError } from '../../utils/apiError'
import { ErrorCodes } from '../../utils/errorCodes'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)

  const dbUser = await userRepository.findById(user.id)

  if (!dbUser) {
    throw apiError(404, ErrorCodes.NOT_FOUND, 'User not found')
  }

  const isOrganizerOrAdmin = dbUser.role === 'ORGANIZER'
    || dbUser.role === 'ADMIN'

  return {
    id: dbUser.id,
    email: dbUser.email,
    role: dbUser.role,
    preferredLocale: dbUser.preferredLocale,
    createdAt: dbUser.createdAt,
    ...(isOrganizerOrAdmin && dbUser.organizerProfile
      ? {
          organizerProfile: {
            id: dbUser.organizerProfile.id,
            slug: dbUser.organizerProfile.slug,
            firstName: dbUser.organizerProfile.firstName,
            lastName: dbUser.organizerProfile.lastName,
            avatarUrl: dbUser.organizerProfile.avatarUrl,
            bio: dbUser.organizerProfile.bio,
            qualification: dbUser.organizerProfile.qualification,
            verificationStatus: dbUser.organizerProfile.verificationStatus,
          },
        }
      : {}),
  }
})
