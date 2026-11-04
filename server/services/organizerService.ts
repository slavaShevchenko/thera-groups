import type { NotificationType } from '@prisma/client'
import { organizerRepository } from '../repositories/organizerRepository'
import { userRepository } from '../repositories/userRepository'
import { createNotification } from '../utils/notifications'
import { sendEmail } from './email'
import { t } from '../i18n'
import { NotFoundError, ValidationError } from '../utils/domainErrors'
import { VERIFICATION_REQUIRED_FIELDS } from '~~/shared/constants/verification'

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

    if (verificationStatus === 'VERIFIED') {
      // Registration collects only a name, a bio and a qualification, so every profile
      // reaches this queue missing the two professional fields — and the PATCH schema lets
      // an organizer save one field at a time. Verifying is the moment the platform vouches
      // for somebody: it unlocks group creation and puts the profile in the public catalog,
      // so the fields the public page advertises have to actually be filled in. Refusing
      // here rather than requiring them on every profile write is what keeps a partial
      // autosave from failing.
      const missing = VERIFICATION_REQUIRED_FIELDS.filter(field => !profile[field]?.trim())

      if (missing.length > 0) {
        throw new ValidationError(
          `Profile is incomplete: ${missing.join(', ')}`,
          missing[0],
        )
      }
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

    await sendEmail({
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
}
