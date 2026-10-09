import { createServerClient } from '../../utils/supabase'
import { prisma } from '../../utils/prisma'
import { useRateLimiter, authLimiter } from '../../utils/rateLimit'
import { takeSignupRole } from '../../utils/oauth'
import { generateUniqueSlug } from '../../utils/slugify'
import { apiError } from '../../utils/apiError'
import { ErrorCodes } from '../../utils/errorCodes'

const userSelect = {
  id: true,
  email: true,
  role: true,
  isActive: true,
  preferredLocale: true,
  organizerProfile: {
    select: {
      id: true,
      slug: true,
      firstName: true,
      lastName: true,
      avatarUrl: true,
      verificationStatus: true,
    },
  },
} as const

/**
 * Opens the PENDING profile an organizer is verified against.
 *
 * Only ever called for a user that has no profile yet, so a repeated Google sign-in
 * cannot produce a second one.
 */
async function createOrganizerProfile(
  userId: string,
  email: string,
  firstName: string,
  lastName: string,
  avatarUrl: string | null,
) {
  const slug = await generateUniqueSlug(
    `${firstName} ${lastName}`.trim() || email.split('@')[0] || 'user',
    s => prisma.organizerProfile.findUnique({ where: { slug: s } }).then(Boolean),
  )

  await prisma.organizerProfile.create({
    data: {
      userId,
      firstName,
      lastName,
      avatarUrl,
      verificationStatus: 'PENDING',
      slug,
    },
  })
}

export default defineEventHandler(async (event) => {
  await useRateLimiter(event, authLimiter)

  const body = await readBody<{ code: string }>(event)

  if (!body?.code) {
    throw apiError(400, ErrorCodes.VALIDATION_FAILED, 'Missing code')
  }

  // The role picked on the sign-in page before the provider redirect, consumed on read.
  const signupRole = takeSignupRole(event)

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
    select: userSelect,
  })

  if (user && !user.isActive) {
    throw apiError(403, ErrorCodes.FORBIDDEN, 'Account is deactivated')
  }

  const metadata = sessionData.user?.user_metadata || {}
  const firstName = metadata.given_name || ''
  const lastName = metadata.family_name || ''
  const avatarUrl = metadata.picture || null

  let changed = false

  if (!user) {
    const newUser = await prisma.user.create({
      data: {
        authId: sessionData.user.id,
        email: authEmail,
        role: signupRole === 'organizer' ? 'ORGANIZER' : 'VISITOR',
        preferredLocale: metadata.locale || 'ua',
      },
    })

    if (signupRole === 'organizer') {
      await createOrganizerProfile(newUser.id, authEmail, firstName, lastName, avatarUrl)
    }

    changed = true
  }
  else if (signupRole === 'organizer' && !user.organizerProfile) {
    // An existing visitor who now wants to organize: the same PENDING profile the
    // registration form creates, plus the role allowed to own groups.
    await createOrganizerProfile(user.id, authEmail, firstName, lastName, avatarUrl)

    if (user.role === 'VISITOR') {
      await prisma.user.update({ where: { id: user.id }, data: { role: 'ORGANIZER' } })
    }

    changed = true
  }

  if (changed) {
    user = await prisma.user.findUnique({
      where: { email: authEmail },
      select: userSelect,
    })
  }

  return { success: true, user }
})
