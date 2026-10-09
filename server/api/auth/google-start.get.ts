import { createServerClient } from '../../utils/supabase'
import { googleStartQuerySchema } from '../../validators/auth'
import { setSignupRole } from '../../utils/oauth'
import { apiError } from '../../utils/apiError'
import { ErrorCodes } from '../../utils/errorCodes'

export default defineEventHandler(async (event) => {
  const parsed = googleStartQuerySchema.safeParse(getQuery(event))
  if (!parsed.success) {
    throw apiError(400, ErrorCodes.VALIDATION_FAILED, 'Invalid query parameters')
  }

  const { locale, role } = parsed.data

  // Read back by POST /api/auth/google once the provider redirects here.
  setSignupRole(event, role)

  const supabase = createServerClient(event)
  const origin = getRequestURL(event).origin

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${origin}/${locale}/auth/callback` },
  })

  if (error || !data.url) {
    throw apiError(500, ErrorCodes.INTERNAL, 'OAuth start failed')
  }

  return { url: data.url }
})
