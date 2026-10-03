import { z } from 'zod'
import { registerSchema } from '../../validators/auth'
import { createAdminClient } from '../../utils/supabase'
import { prisma } from '../../utils/prisma'
import { generateUniqueSlug } from '../../utils/slugify'
import { useRateLimiter, registerLimiter } from '../../utils/rateLimit'
import { mapPrismaError } from '../../utils/errorHandler'
import { apiError } from '../../utils/apiError'
import { ErrorCodes } from '../../utils/errorCodes'

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
    const existingInDb = await prisma.user.findUnique({ where: { email } })

    if (existingInDb) {
      throw apiError(400, ErrorCodes.VALIDATION_FAILED, 'Registration failed')
    }

    const { data: usersList } = await adminClient.auth.admin.listUsers()
    const orphanUser = usersList?.users.find(u => u.email === email)

    if (orphanUser) {
      await adminClient.auth.admin.deleteUser(orphanUser.id).catch(() => { })
    }

    const retry = await createAuthUser()
    signUpData = retry.data
    signUpError = retry.error
  }

  if (signUpError) {
    console.error('Supabase createUser error:', signUpError.message)
    throw apiError(500, ErrorCodes.INTERNAL, 'Registration failed')
  }

  if (!signUpData.user) {
    throw apiError(500, ErrorCodes.INTERNAL, 'Registration failed')
  }

  let newUser
  try {
    newUser = await prisma.user.create({
      data: {
        authId: signUpData.user.id,
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
          verificationStatus: 'PENDING',
          slug,
        },
      })

      // Notify admins about new profile pending verification
      const { notifyAdminsOrganizerPendingReview } = await import('../../utils/notifications')
      await notifyAdminsOrganizerPendingReview(
        `${organizerData.firstName} ${organizerData.lastName}`,
        slug,
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
    await adminClient.auth.admin.deleteUser(signUpData.user.id).catch(() => { })
    if (newUser) {
      await prisma.user.delete({ where: { id: newUser.id } }).catch(() => { })
    }

    throw mapPrismaError(error, 'register')
  }
})
