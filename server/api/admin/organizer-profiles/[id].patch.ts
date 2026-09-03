import { z } from 'zod'
import { requireRole } from '../../../utils/auth'
import { prisma } from '../../../utils/prisma'
import { createNotification } from '../../../utils/notifications'

const schema = z.object({
  verificationStatus: z.enum(['VERIFIED', 'REJECTED']),
  rejectionReason: z.string().max(1000).optional(),
})

export default defineEventHandler(async (event) => {
  await requireRole(event, ['ADMIN'])

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Profile ID is required' })
  }

  const body = await readBody(event)
  let data
  try {
    data = schema.parse(body)
  }
  catch (error) {
    if (error instanceof z.ZodError) {
      throw createError({ statusCode: 400, statusMessage: 'Validation failed', data: { details: error.issues } })
    }
    throw error
  }

  if (data.verificationStatus === 'REJECTED' && !data.rejectionReason?.trim()) {
    throw createError({ statusCode: 400, statusMessage: 'Rejection reason is required' })
  }

  const profile = await prisma.organizerProfile.findUnique({
    where: { id },
    include: { user: { select: { id: true } } },
  })

  if (!profile) {
    throw createError({ statusCode: 404, statusMessage: 'Profile not found' })
  }

  if (profile.verificationStatus !== 'PENDING') {
    throw createError({ statusCode: 400, statusMessage: 'Can only moderate PENDING profiles' })
  }

  const updated = await prisma.organizerProfile.update({
    where: { id },
    data: {
      verificationStatus: data.verificationStatus,
      rejectionReason: data.verificationStatus === 'REJECTED' ? data.rejectionReason : null,
    },
  })

  // Уведомляем организатора
  const title = data.verificationStatus === 'VERIFIED'
    ? 'Профіль верифіковано'
    : 'Профіль відхилено'
  const message = data.verificationStatus === 'VERIFIED'
    ? `Ваш профіль «${profile.firstName} ${profile.lastName}» верифіковано`
    : `Ваш профіль «${profile.firstName} ${profile.lastName}» відхилено. Причина: ${data.rejectionReason}`

  await createNotification(
    profile.user.id,
    data.verificationStatus === 'VERIFIED' ? 'GROUP_APPROVED' : 'GROUP_REJECTED',
    'organizerProfile',
    profile.slug,
    title,
    message,
  )

  return {
    id: updated.id,
    slug: updated.slug,
    verificationStatus: updated.verificationStatus,
  }
})
