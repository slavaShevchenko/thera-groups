import { createServerClient } from '../../utils/supabase'
import { userRepository } from '../../repositories/userRepository'
import { prisma } from '../../utils/prisma'
import { useRateLimiter, authLimiter } from '../../utils/rateLimit'
import { takeSignupRole } from '../../utils/oauth'
import { generateUniqueSlug } from '../../utils/slugify'
import { normalizeEmail } from '../../utils/emailAddress'
import { findPrismaError } from '../../utils/errorHandler'
import { apiError } from '../../utils/apiError'
import { ErrorCodes } from '../../utils/errorCodes'

const oauthFailed = () => apiError(400, ErrorCodes.VALIDATION_FAILED, 'oauth_failed')

// Two different accounts, one address. Refused rather than merged: silently adopting the
// existing row would hand the Google caller somebody else's groups and applications.
const emailOwnedByAnotherIdentity = () =>
  apiError(
    409,
    ErrorCodes.CONFLICT,
    'Account with this email exists under a different provider',
  )

const isUniqueViolation = (error: unknown) => findPrismaError(error)?.code === 'P2002'

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

/**
 * Makes `public.User` agree with the identity Supabase just authenticated, and says
 * whether it had to write anything.
 *
 * Resolution is by `authId` first and by email second, which is the opposite of what it
 * used to be. Email-only matching meant a Google account whose address changed could
 * never be reconciled: the local row kept the old address, the new one matched nothing,
 * and every later sign-in either created a second account or died on the unique `email`
 * with a P2002 nobody could recover from. Now:
 *
 *  1. a row already carrying this `authId` is the same person — repair its address;
 *  2. a row carrying the address with **no** `authId` is a password sign-up meeting its
 *     provider for the first time — link them;
 *  3. a row carrying the address under a **different** `authId` is somebody else — refuse;
 *  4. otherwise the identity is new — create it.
 */
async function reconcileLocalUser(authId: string, email: string): Promise<boolean> {
  const byAuthId = await userRepository.findSessionUserByAuthId(authId)

  if (byAuthId) {
    if (byAuthId.email === email) return false

    try {
      await userRepository.update(byAuthId.id, { email })
    }
    catch (error) {
      // The new address already belongs to a different local account.
      if (isUniqueViolation(error)) throw emailOwnedByAnotherIdentity()
      throw error
    }

    return true
  }

  const link = await userRepository.findAuthLinkByEmail(email)

  if (!link) {
    return false
  }

  if (link.authId && link.authId !== authId) {
    throw emailOwnedByAnotherIdentity()
  }

  if (link.authId === authId) return false

  try {
    await userRepository.update(link.id, { authId })
  }
  catch (error) {
    if (isUniqueViolation(error)) throw emailOwnedByAnotherIdentity()
    throw error
  }

  return true
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
    throw oauthFailed()
  }

  const authId = sessionData.user?.id
  const rawEmail = sessionData.user?.email

  if (!authId || !rawEmail) {
    throw oauthFailed()
  }

  // GoTrue stores addresses lower-cased, but nothing forces a provider to send one that
  // way, and every lookup below is a byte-for-byte unique match.
  const email = normalizeEmail(rawEmail)

  const reconciled = await reconcileLocalUser(authId, email)

  let user = await userRepository.findSessionUserByAuthId(authId)

  if (!user && !reconciled) {
    const metadata = sessionData.user?.user_metadata || {}

    await prisma.user.create({
      data: {
        authId,
        email,
        role: signupRole === 'organizer' ? 'ORGANIZER' : 'VISITOR',
        preferredLocale: metadata.locale || 'ua',
      },
    })

    user = await userRepository.findSessionUserByAuthId(authId)
  }

  if (!user) {
    throw oauthFailed()
  }

  // Checked on every resolution path, not only the one that created a row: an account
  // deactivated while its Google session is still valid must not get back in.
  if (!user.isActive) {
    throw apiError(403, ErrorCodes.FORBIDDEN, 'Account is deactivated')
  }

  const metadata = sessionData.user?.user_metadata || {}
  const firstName = metadata.given_name || ''
  const lastName = metadata.family_name || ''
  const avatarUrl = metadata.picture || null

  if (signupRole === 'organizer' && !user.organizerProfile) {
    // Either a brand-new account or an existing visitor who now wants to organize: the
    // same PENDING profile the registration form creates, plus the role allowed to own
    // groups.
    await createOrganizerProfile(user.id, email, firstName, lastName, avatarUrl)

    if (user.role === 'VISITOR') {
      await userRepository.update(user.id, { role: 'ORGANIZER' })
    }

    user = (await userRepository.findSessionUserByAuthId(authId)) ?? user
  }

  return { success: true, user }
})
