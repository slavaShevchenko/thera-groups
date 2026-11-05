import { z } from 'zod'
import { registerSchema } from '../../validators/auth'
import { createAdminClient, findAuthUsersByEmail } from '../../utils/supabase'
import { prisma } from '../../utils/prisma'
import { generateUniqueSlug } from '../../utils/slugify'
import { useRateLimiter, useEmailRateLimiter, registerLimiter } from '../../utils/rateLimit'
import { mapPrismaError } from '../../utils/errorHandler'
import { apiError } from '../../utils/apiError'
import { ErrorCodes } from '../../utils/errorCodes'

// `useUser().register()` matches this exact statusMessage to show the localized
// "email already exists" hint instead of a generic failure.
const emailAlreadyExists = () =>
  apiError(409, ErrorCodes.CONFLICT, 'User with this email already exists')

/**
 * Whether an `auth.users` record with no `public.User` row may be deleted to make room for
 * this sign-up.
 *
 * Only a password record qualifies. An address attached to a social identity belongs to
 * somebody who signed in through that provider, and deleting it because a stranger typed
 * the same address into the registration form is an account takeover with one request: the
 * victim's Google login stops working and the address ends up owned by the attacker's
 * password. Those are reported as taken instead.
 *
 * A refused Google sign-in is not left here to be reasoned about: `google.post.ts` cannot
 * be wrong about who just completed the provider's consent flow, so it deletes the row its
 * own code exchange wrote before answering 404. This endpoint stays the conservative half.
 */
const isDeletableOrphan = (providers: string[]) =>
  providers.every(provider => provider === 'email')

export default defineEventHandler(async (event) => {
  await useRateLimiter(event, registerLimiter)

  const body = await readBody(event)

  let data
  try {
    data = registerSchema.parse(body)
  }
  catch (error) {
    if (error instanceof z.ZodError) {
      throw apiError(400, ErrorCodes.VALIDATION_FAILED, 'Validation failed', { details: error.issues })
    }
    throw error
  }

  const { email, password, role, preferredLocale, organizerData } = data

  // Per-account ceiling on top of the per-address one, so rotating source addresses does
  // not give an attacker unlimited attempts at a single address.
  await useEmailRateLimiter(registerLimiter, email, event)

  if (role === 'ORGANIZER' && !organizerData) {
    throw apiError(400, ErrorCodes.VALIDATION_FAILED, 'Validation failed')
  }

  const adminClient = createAdminClient()

  const isAlreadyRegistered = (error: { message?: string, code?: string }) =>
    error.message?.includes('already been registered') || error.code === 'email_exists'

  const createAuthUser = () =>
    adminClient.auth.admin.createUser({ email, password, email_confirm: true })

  let { data: signUpData, error: signUpError } = await createAuthUser()

  if (signUpError && isAlreadyRegistered(signUpError)) {
    // `email` arrives normalized by `registerSchema`, and `findAuthUsersByEmail` normalizes
    // its side too. They have to agree: a case difference between the two made this lookup
    // miss a real account, and the orphan cleanup below then deleted it.
    const existingInDb = await prisma.user.findUnique({ where: { email } })

    if (existingInDb) {
      throw emailAlreadyExists()
    }

    // The address is taken in auth.users but has no public.User row: the
    // database half of an earlier sign-up failed, or public was restored
    // without auth. It blocks every retry, so it is cleared and sign-up replayed.
    let orphans: { id: string, providers: string[] }[] = []
    try {
      orphans = await findAuthUsersByEmail(adminClient, email)
    }
    catch (error) {
      console.warn(`[register] auth.users lookup failed: ${(error as Error).message}`)
    }

    if (!orphans.length) {
      throw emailAlreadyExists()
    }

    if (orphans.some(orphan => !isDeletableOrphan(orphan.providers))) {
      throw emailAlreadyExists()
    }

    for (const orphan of orphans) {
      const { error: deleteError } = await adminClient.auth.admin.deleteUser(orphan.id)
      if (deleteError) {
        console.warn(`[register] orphaned auth user ${orphan.id} not deleted: ${deleteError.message}`)
      }
    }

    const retry = await createAuthUser()
    signUpData = retry.data
    signUpError = retry.error

    if (signUpError && isAlreadyRegistered(signUpError)) {
      throw emailAlreadyExists()
    }
  }

  const authUser = signUpData?.user

  if (signUpError || !authUser) {
    // The Supabase reason rides along as `cause` so the Nitro `error` hook logs
    // it; logging here as well would report one failure twice.
    throw createError({
      statusCode: 500,
      statusMessage: 'Registration failed',
      data: { code: ErrorCodes.INTERNAL },
      cause: signUpError ?? new Error('Supabase createUser returned no user'),
    })
  }

  let newUser
  try {
    newUser = await prisma.user.create({
      data: {
        authId: authUser.id,
        email,
        role,
        preferredLocale,
      },
    })

    if (role === 'ORGANIZER' && organizerData) {
      const slug = await generateUniqueSlug(
        `${organizerData.firstName} ${organizerData.lastName}`,
        s => prisma.organizerProfile.findUnique({ where: { slug: s } }).then(Boolean),
      )

      await prisma.organizerProfile.create({
        data: {
          userId: newUser.id,
          firstName: organizerData.firstName,
          lastName: organizerData.lastName,
          bio: organizerData.bio,
          qualification: organizerData.qualification,
          professionalOrganization: organizerData.professionalOrganization,
          professionalOrganizationStatus: organizerData.professionalOrganizationStatus,
          verificationStatus: 'PENDING',
          slug,
        },
      })

      const { notifyAdminsOrganizerPendingReview, notifyOrganizerWelcome }
        = await import('../../utils/notifications')

      // Notify admins about new profile pending verification
      await notifyAdminsOrganizerPendingReview(
        `${organizerData.firstName} ${organizerData.lastName}`,
        slug,
      )

      // Tell the organizer the profile exists and what happens next. Verification can take
      // days, and a sign-up that produces no message reads as a sign-up that failed.
      await notifyOrganizerWelcome(
        newUser.id,
        email,
        organizerData.firstName,
        slug,
        preferredLocale,
      )
    }

    const createdProfile = role === 'ORGANIZER'
      ? await prisma.organizerProfile.findUnique({ where: { userId: newUser.id } })
      : null

    return {
      success: true,
      user: {
        id: newUser.id,
        email: newUser.email,
        role: newUser.role,
        organizerProfile: createdProfile
          ? {
              id: createdProfile.id,
              firstName: createdProfile.firstName,
              lastName: createdProfile.lastName,
              verificationStatus: createdProfile.verificationStatus,
            }
          : null,
      },
    }
  }
  catch (error) {
    // Rollback. An auth account left behind here is exactly the orphan that
    // blocks the next sign-up with this address, so a failed delete gets a line.
    const rollback = await adminClient.auth.admin.deleteUser(authUser.id)
      .catch((deleteError: unknown) => ({ error: deleteError as Error }))

    if (rollback.error) {
      console.warn(`[register] rollback kept auth user ${authUser.id}: ${rollback.error.message}`)
    }

    if (newUser) {
      await prisma.user.delete({ where: { id: newUser.id } }).catch(() => { })
    }

    throw mapPrismaError(error, 'register')
  }
})
