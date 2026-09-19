import { createServerClient } from '../../utils/supabase'
import { apiError } from '../../utils/apiError'
import { ErrorCodes } from '../../utils/errorCodes'

export default defineEventHandler(async (event) => {
  const supabase = createServerClient(event)
  const origin = getRequestURL(event).origin
  const query = getQuery(event)
  const locale = (query.locale as string) || 'ua'

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${origin}/${locale}/auth/callback` },
  })

  if (error || !data.url) {
    throw apiError(500, ErrorCodes.INTERNAL, 'OAuth start failed')
  }

  return { url: data.url }
})
