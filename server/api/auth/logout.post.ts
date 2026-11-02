import { createServerClient } from '../../utils/supabase'
import { apiError } from '../../utils/apiError'
import { ErrorCodes } from '../../utils/errorCodes'

export default defineEventHandler(async (event) => {
  const supabase = createServerClient(event)

  const { error } = await supabase.auth.signOut()

  if (error) {
    throw apiError(500, ErrorCodes.INTERNAL, 'Logout failed', undefined, error)
  }

  return { success: true }
})
