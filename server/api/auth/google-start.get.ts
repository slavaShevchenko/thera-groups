import { createServerClient } from '../../utils/supabase'
import { googleStartQuerySchema } from '../../validators/auth'
import { oauthRedirectOrigin } from '../../utils/oauth'
import { apiError } from '../../utils/apiError'
import { ErrorCodes } from '../../utils/errorCodes'

export default defineEventHandler(async (event) => {
  const parsed = googleStartQuerySchema.safeParse(getQuery(event))
  if (!parsed.success) {
    throw apiError(400, ErrorCodes.VALIDATION_FAILED, 'Invalid query parameters')
  }

  const { locale } = parsed.data

  const supabase = createServerClient(event)

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${oauthRedirectOrigin(event)}/${locale}/auth/callback` },
  })

  if (error || !data.url) {
    throw apiError(500, ErrorCodes.INTERNAL, 'OAuth start failed')
  }

  return { url: data.url }
})
