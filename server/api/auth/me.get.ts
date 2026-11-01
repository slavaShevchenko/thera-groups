import { createServerClient } from '../../utils/supabase'
import { userRepository } from '../../repositories/userRepository'
import { AUTH_SESSION_DISABLED } from '~~/shared/constants/auth'

export default defineEventHandler(async (event) => {
  const supabase = createServerClient(event)
  const { data: { user: authUser } } = await supabase.auth.getUser()

  if (!authUser) return { user: null }

  const user = await userRepository.findByAuthId(authUser.id)

  if (!user) return { user: null }

  // Reported as signed out rather than as a session that requireAuth() rejects with 403
  // on every subsequent call. The `reason` is what lets the client tell "banned while the
  // tab was open" from "never signed in" — without it the route guard can only bounce to
  // the login page in silence and the visitor retries their password against a 403.
  if (!user.isActive) return { user: null, reason: AUTH_SESSION_DISABLED }

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
