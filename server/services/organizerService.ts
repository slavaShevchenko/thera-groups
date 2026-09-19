import type { NotificationType } from '@prisma/client'
import { createNotification } from '../utils/notifications'
import { t } from '../i18n'

export const organizerService = {
  /**
   * Verify or reject an organizer profile. Sends localized notification.
   */
  async moderateProfile(
    id: string,
    verificationStatus: 'VERIFIED' | 'REJECTED',
    rejectionReason: string | undefined,
    notificationType: NotificationType,
  ) {
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

    if (verificationStatus === 'REJECTED' && !rejectionReason?.trim()) {
      throw createError({ statusCode: 400, statusMessage: 'Rejection reason is required' })
    }

    const updated = await prisma.organizerProfile.update({
      where: { id },
      data: {
        verificationStatus,
        rejectionReason: verificationStatus === 'REJECTED' ? rejectionReason : null,
      },
    })

    const locale = profile.user.preferredLocale === 'en' ? 'en' : 'ua'
    const name = `${profile.firstName} ${profile.lastName}`

    const key = verificationStatus === 'VERIFIED' ? 'organizer.verified' : 'organizer.rejected'
    const params: Record<string, string> = verificationStatus === 'VERIFIED'
      ? { name }
      : { name, reason: rejectionReason ?? '' }
    const { subject, body: emailBody } = t(key, locale, params)

    await createNotification(
      profile.user.id,
      notificationType,
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
  },

  /**
   * Toggle organizer active/inactive status.
   */
  async toggleActive(id: string) {
    const organizer = await prisma.organizerProfile.findUnique({
      where: { id },
      include: { user: true },
    })

    if (!organizer) {
      throw createError({ statusCode: 404, statusMessage: 'Organizer not found' })
    }

    const updated = await prisma.user.update({
      where: { id: organizer.userId },
      data: { isActive: !organizer.user.isActive },
    })

    return {
      id: organizer.id,
      isActive: updated.isActive,
    }
  },

  /**
   * Quick verify (from admin organizers list). Only allows PENDING → VERIFIED.
   */
  async verify(id: string) {
    const organizer = await prisma.organizerProfile.findUnique({
      where: { id },
    })

    if (!organizer) {
      throw createError({ statusCode: 404, statusMessage: 'Organizer not found' })
    }

    if (organizer.verificationStatus !== 'PENDING') {
      throw createError({ statusCode: 409, statusMessage: 'Organizer is not in pending state' })
    }

    const updated = await prisma.organizerProfile.update({
      where: { id },
      data: { verificationStatus: 'VERIFIED' },
    })

    return {
      id: updated.id,
      verificationStatus: updated.verificationStatus,
    }
  },
}
