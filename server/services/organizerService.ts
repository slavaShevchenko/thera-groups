import type { NotificationType } from '@prisma/client'
import { organizerRepository } from '../repositories/organizerRepository'
import { userRepository } from '../repositories/userRepository'
import { createNotification } from '../utils/notifications'
import { sendEmailFireAndForget } from './email'
import { t } from '../i18n'
import { NotFoundError, ValidationError, ConflictError } from '../utils/domainErrors'

export const organizerService = {
  async moderateProfile(
    id: string,
    verificationStatus: 'VERIFIED' | 'REJECTED',
    rejectionReason: string | undefined,
    notificationType: NotificationType,
  ) {
    const profile = await organizerRepository.findByIdWithUser(id)

    if (!profile) {
      throw new NotFoundError('Profile not found')
    }

    if (profile.verificationStatus !== 'PENDING') {
      throw new ValidationError('Can only moderate PENDING profiles')
    }

    if (verificationStatus === 'REJECTED' && !rejectionReason?.trim()) {
      throw new ValidationError('Rejection reason is required')
    }

    const updated = await organizerRepository.update(id, {
      verificationStatus,
      rejectionReason: verificationStatus === 'REJECTED' ? rejectionReason : null,
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

    sendEmailFireAndForget({
      to: profile.user.email,
      template: verificationStatus === 'VERIFIED' ? 'organizer_verified' : 'organizer_rejected',
      locale,
      data: verificationStatus === 'VERIFIED'
        ? { recipientName: name, organizerName: name }
        : { recipientName: name, organizerName: name, reason: rejectionReason ?? '' },
      entityId: profile.slug,
    })

    return {
      id: updated.id,
      slug: updated.slug,
      verificationStatus: updated.verificationStatus,
    }
  },

  async toggleActive(id: string) {
    const organizer = await organizerRepository.findByIdWithFullUser(id)

    if (!organizer) {
      throw new NotFoundError('Organizer not found')
    }

    const updated = await userRepository.update(organizer.userId, {
      isActive: !organizer.user.isActive,
    })

    return {
      id: organizer.id,
      isActive: updated.isActive,
    }
  },

  async verify(id: string) {
    const organizer = await organizerRepository.findById(id)

    if (!organizer) {
      throw new NotFoundError('Organizer not found')
    }

    if (organizer.verificationStatus !== 'PENDING') {
      throw new ConflictError('Organizer is not in pending state')
    }

    const updated = await organizerRepository.update(id, {
      verificationStatus: 'VERIFIED',
    })

    return {
      id: updated.id,
      verificationStatus: updated.verificationStatus,
    }
  },
}
