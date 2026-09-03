import { createServerClient } from '../../utils/supabase'
import { getUser } from '../../utils/auth'

export default defineEventHandler(async (event) => {
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
    throw createError({
      statusCode: 400,
      statusMessage: 'oauth_failed',
    })
  }

  const user = await getUser(event)

  return { success: true, user }
})
