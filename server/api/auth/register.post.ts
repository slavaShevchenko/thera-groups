import { z } from 'zod'
import { registerSchema } from '../../validators/auth'
import { createAdminClient } from '../../utils/supabase'
import { prisma } from '../../utils/prisma'
import { generateUniqueSlug } from '../../utils/slugify'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)

  let data
  try {
    data = registerSchema.parse(body)
  }
  catch (error) {
    if (error instanceof z.ZodError) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Validation failed',
        data: { details: error.issues },
      })
    }
    throw error
  }

  const { email, password, role, preferredLocale, organizerData } = data

  if (role === 'ORGANIZER' && !organizerData) {
    throw createError({
      statusCode: 400,
      statusMessage: 'organizerData is required for ORGANIZER role',
    })
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
      throw createError({
        statusCode: 409,
        statusMessage: 'User with this email already exists',
      })
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
    throw createError({
      statusCode: 500,
      statusMessage: 'Registration failed',
    })
  }

  if (!signUpData.user) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Registration failed',
    })
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
    }

    return {
      success: true,
      user: {
        id: newUser.id,
        email: newUser.email,
        role: newUser.role,
      },
    }
  }
  catch (error) {
    console.error('Database error during registration:', error)

    await adminClient.auth.admin.deleteUser(signUpData.user.id).catch(() => { })
    if (newUser) {
      await prisma.user.delete({ where: { id: newUser.id } }).catch(() => { })
    }

    throw createError({
      statusCode: 500,
      statusMessage: 'Registration failed',
    })
  }
})
