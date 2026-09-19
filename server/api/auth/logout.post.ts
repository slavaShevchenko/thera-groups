import { createServerClient } from '../../utils/supabase'
import { apiError } from '../../utils/apiError'
import { ErrorCodes } from '../../utils/errorCodes'

export default defineEventHandler(async (event) => {
  const supabase = createServerClient(event)

  const { error } = await supabase.auth.signOut()

  if (error) {
    console.error('Supabase signOut error:', error.message)
    throw apiError(500, ErrorCodes.INTERNAL, 'Logout failed')
  }

  return { success: true }
})
