import { z } from 'zod'
import { registerSchema } from '../../validators/auth'
import { createAdminClient } from '../../utils/supabase'
import { prisma } from '../../utils/prisma'

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

  const { email, password, role, preferredLocale, therapistData } = data

  if (role === 'THERAPIST' && !therapistData) {
    throw createError({
      statusCode: 400,
      statusMessage: 'therapistData is required for THERAPIST role',
    })
  }

  const adminClient = createAdminClient()

  const { data: signUpData, error: signUpError } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })

  if (signUpError) {
    if (
      signUpError.message.includes('already been registered')
      || signUpError.code === 'email_exists'
    ) {
      throw createError({
        statusCode: 409,
        statusMessage: 'User with this email already exists',
      })
    }

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
    // Создаём User без транзакции
    newUser = await prisma.user.create({
      data: {
        authId: signUpData.user.id,
        email,
        role,
        preferredLocale,
      },
    })

    // Если терапевт — создаём профиль
    if (role === 'THERAPIST' && therapistData) {
      await prisma.therapistProfile.create({
        data: {
          userId: newUser.id,
          firstName: therapistData.firstName,
          lastName: therapistData.lastName,
          bio: therapistData.bio,
          qualification: therapistData.qualification,
          verificationStatus: 'PENDING',
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

    // Компенсация: удаляем Supabase-юзера и Prisma-юзера (если создан)
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
