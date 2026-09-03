import { createServerClient } from '../../utils/supabase'

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
    throw createError({ statusCode: 500, statusMessage: 'OAuth start failed' })
  }

  // eslint-disable-next-line no-console
  console.log('[google-start] set-cookie:', getResponseHeader(event, 'set-cookie'))

  return { url: data.url }
})
