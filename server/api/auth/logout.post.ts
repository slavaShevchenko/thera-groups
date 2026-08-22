import { createServerClient } from '../../utils/supabase'

export default defineEventHandler(async (event) => {
  const supabase = createServerClient(event)

  const { error } = await supabase.auth.signOut()

  if (error) {
    console.error('Supabase signOut error:', error.message)
    throw createError({
      statusCode: 500,
      statusMessage: 'Logout failed',
    })
  }

  return { success: true }
})
