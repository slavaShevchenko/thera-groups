import { createServerClient } from '../../utils/supabase'
import { userRepository } from '../../repositories/userRepository'

export default defineEventHandler(async (event) => {
  const supabase = createServerClient(event)
  const { data: { user: authUser } } = await supabase.auth.getUser()

  if (!authUser) return { user: null }

  const user = await userRepository.findByAuthId(authUser.id)

  if (!user) return { user: null }

  // Reported as signed out rather than as a session that requireAuth() rejects with 403
  // on every subsequent call. The login endpoint explains why when they sign in again.
  if (!user.isActive) return { user: null }

  return {
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      organizerProfile: user.organizerProfile
        ? {
            id: user.organizerProfile.id,
            firstName: user.organizerProfile.firstName,
            lastName: user.organizerProfile.lastName,
            verificationStatus: user.organizerProfile.verificationStatus,
          }
        : null,
    },
  }
})
