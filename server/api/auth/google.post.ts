import { createServerClient } from '../../utils/supabase'
import { getUser } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  // eslint-disable-next-line no-console
  console.log('[google] received cookies:', Object.keys(parseCookies(event)))

  const body = await readBody<{ code: string }>(event)

  if (!body?.code) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Missing code',
    })
  }

  const supabase = createServerClient(event)

  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(body.code)

  if (exchangeError) {
    // eslint-disable-next-line no-console
    console.log('[google] exchange error:', exchangeError.message)
    throw createError({
      statusCode: 400,
      statusMessage: 'oauth_failed',
    })
  }

  const user = await getUser(event)

  return { success: true, user }
})
