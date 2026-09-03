import { createServerClient } from '../../utils/supabase'
import { prisma } from '../../utils/prisma'

export default defineEventHandler(async (event) => {
  const body = await readBody<{ code: string }>(event)

  if (!body?.code) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Missing code',
    })
  }

  const supabase = createServerClient(event)

  const { error: exchangeError, data: sessionData } = await supabase.auth.exchangeCodeForSession(body.code)

  if (exchangeError) {
    throw createError({
      statusCode: 400,
      statusMessage: 'oauth_failed',
    })
  }

  const authEmail = sessionData.user?.email
  if (!authEmail) {
    throw createError({
      statusCode: 400,
      statusMessage: 'oauth_failed',
    })
  }

  const user = await prisma.user.findUnique({
    where: { email: authEmail },
    include: { organizerProfile: true },
  })

  if (!user) {
    return { success: false, error: 'account_not_found', email: authEmail }
  }

  return { success: true, user }
})
