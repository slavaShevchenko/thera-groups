import { createServerClient } from '../../utils/supabase'
import { prisma } from '../../utils/prisma'
import { useRateLimiter } from '../../utils/rateLimit'
import { apiError } from '../../utils/apiError'
import { ErrorCodes } from '../../utils/errorCodes'

export default defineEventHandler(async (event) => {
  await useRateLimiter(event, 'auth')

  const body = await readBody<{ code: string }>(event)

  if (!body?.code) {
    throw apiError(400, ErrorCodes.VALIDATION_FAILED, 'Missing code')
  }

  const supabase = createServerClient(event)

  const { error: exchangeError, data: sessionData } = await supabase.auth.exchangeCodeForSession(body.code)

  if (exchangeError) {
    throw apiError(400, ErrorCodes.VALIDATION_FAILED, 'oauth_failed')
  }

  const authEmail = sessionData.user?.email
  if (!authEmail) {
    throw apiError(400, ErrorCodes.VALIDATION_FAILED, 'oauth_failed')
  }

  let user = await prisma.user.findUnique({
    where: { email: authEmail },
    include: { organizerProfile: true },
  })

  if (!user) {
    const metadata = sessionData.user?.user_metadata || {}
    const firstName = metadata.given_name || ''
    const lastName = metadata.family_name || ''
    const avatarUrl = metadata.picture || null

    const newUser = await prisma.user.create({
      data: {
        authId: sessionData.user.id,
        email: authEmail,
        role: 'VISITOR',
        preferredLocale: metadata.locale || 'ua',
      },
    })

    if (firstName || lastName || avatarUrl) {
      const { generateUniqueSlug } = await import('../../utils/slugify')
      const slug = await generateUniqueSlug(
        `${firstName} ${lastName}`.trim() || authEmail.split('@')[0] || 'user',
        s => prisma.organizerProfile.findUnique({ where: { slug: s } }).then(Boolean),
      )

      await prisma.organizerProfile.create({
        data: {
          userId: newUser.id,
          firstName,
          lastName,
          avatarUrl,
          verificationStatus: 'UNVERIFIED',
          slug,
        },
      })
    }

    user = await prisma.user.findUnique({
      where: { email: authEmail },
      include: { organizerProfile: true },
    })
  }

  return { success: true, user }
})
