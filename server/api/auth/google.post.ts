import { createServerClient } from '../../utils/supabase'
import { getUser } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  // eslint-disable-next-line no-console
  console.log('[google] starting exchange, cookies:', Object.keys(parseCookies(event)))

  const body = await readBody<{ code: string }>(event)

  if (!body?.code) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Missing code',
    })
  }

  // eslint-disable-next-line no-console
  console.log('[google] code received, length:', body.code.length)

  const supabase = createServerClient(event)

  const { error: exchangeError, data: sessionData } = await supabase.auth.exchangeCodeForSession(body.code)

  if (exchangeError) {
    // eslint-disable-next-line no-console
    console.log('[google] exchange failed:', exchangeError.message)
    throw createError({
      statusCode: 400,
      statusMessage: 'oauth_failed',
    })
  }

  // eslint-disable-next-line no-console
  console.log('[google] exchange success, auth user id:', sessionData.user?.id, 'email:', sessionData.user?.email)

  const user = await getUser(event)

  // eslint-disable-next-line no-console
  console.log('[google] getUser result:', user ? `found (id: ${user.id}, email: ${user.email})` : 'null')

  return { success: true, user }
})
