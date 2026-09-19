import { z } from 'zod'
import { loginSchema } from '../../validators/auth'
import { createServerClient } from '../../utils/supabase'
import { userRepository } from '../../repositories/userRepository'
import { useRateLimiter } from '../../utils/rateLimit'
import { apiError } from '../../utils/apiError'
import { ErrorCodes } from '../../utils/errorCodes'

export default defineEventHandler(async (event) => {
  await useRateLimiter(event, 'auth')

  const body = await readBody(event)

  let data
  try {
    data = loginSchema.parse(body)
  }
  catch (error) {
    if (error instanceof z.ZodError) {
      throw apiError(400, ErrorCodes.VALIDATION_FAILED, 'Validation failed', { details: error.issues })
    }
    throw error
  }

  const supabase = createServerClient(event)

  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: data.email,
    password: data.password,
  })

  if (signInError) {
    throw apiError(401, ErrorCodes.UNAUTHORIZED, 'Invalid credentials')
  }

  const { data: { user: authUser } } = await supabase.auth.getUser()

  if (!authUser) {
    throw apiError(401, ErrorCodes.UNAUTHORIZED, 'Invalid credentials')
  }

  const user = await userRepository.findByAuthId(authUser.id)

  if (!user) {
    throw apiError(401, ErrorCodes.UNAUTHORIZED, 'Invalid credentials')
  }

  if (!user.isActive) {
    await supabase.auth.signOut()
    throw apiError(403, ErrorCodes.FORBIDDEN, 'Account disabled')
  }

  return {
    success: true,
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
    },
  }
})
