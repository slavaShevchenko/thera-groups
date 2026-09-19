import { z } from 'zod'
import { requireAuth } from '../../../utils/auth'
import { requirePermission } from '../../../utils/permissions'
import { prisma } from '../../../utils/prisma'
import { createNotification } from '../../../utils/notifications'
import { t } from '../../../i18n'

const schema = z.object({
  verificationStatus: z.enum(['VERIFIED', 'REJECTED']),
  rejectionReason: z.string().max(1000).optional(),
})

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  requirePermission(user, 'admin.profiles.moderate')

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
    include: { user: { select: { id: true, preferredLocale: true } } },
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

  const locale = profile.user.preferredLocale === 'en' ? 'en' : 'ua'
  const name = `${profile.firstName} ${profile.lastName}`

  const key = data.verificationStatus === 'VERIFIED' ? 'organizer.verified' : 'organizer.rejected'
  const params: Record<string, string> = data.verificationStatus === 'VERIFIED'
    ? { name }
    : { name, reason: data.rejectionReason ?? '' }
  const { subject, body: emailBody } = t(key, locale, params)

  await createNotification(
    profile.user.id,
    data.verificationStatus === 'VERIFIED' ? 'GROUP_APPROVED' : 'GROUP_REJECTED',
    'organizerProfile',
    profile.slug,
    subject,
    emailBody,
  )

  return {
    id: updated.id,
    slug: updated.slug,
    verificationStatus: updated.verificationStatus,
  }
})
