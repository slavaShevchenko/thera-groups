import type { NotificationType } from '@prisma/client'
import { organizerRepository } from '../repositories/organizerRepository'
import { userRepository } from '../repositories/userRepository'
import { createNotification } from '../utils/notifications'
import { t } from '../i18n'

export const organizerService = {
  /**
   * Approves or rejects an organizer profile after admin moderation.
   * Only PENDING profiles can be moderated; rejection requires a reason.
   * Sends a localized notification to the organizer with the decision.
   * @param id - The organizer profile ID
   * @param verificationStatus - Target status: VERIFIED or REJECTED
   * @param rejectionReason - Required when rejecting; ignored when verifying
   * @param notificationType - The type of notification to create (e.g. organizerProfile)
   * @returns The updated profile with id, slug, and verificationStatus
   * @throws 404 if profile not found, 400 if profile is not PENDING or rejection reason is missing
   */
  async moderateProfile(
    id: string,
    verificationStatus: 'VERIFIED' | 'REJECTED',
    rejectionReason: string | undefined,
    notificationType: NotificationType,
  ) {
    const profile = await organizerRepository.findByIdWithUser(id)

    if (!profile) {
      throw createError({ statusCode: 404, statusMessage: 'Profile not found' })
    }

    if (profile.verificationStatus !== 'PENDING') {
      throw createError({ statusCode: 400, statusMessage: 'Can only moderate PENDING profiles' })
    }

    if (verificationStatus === 'REJECTED' && !rejectionReason?.trim()) {
      throw createError({ statusCode: 400, statusMessage: 'Rejection reason is required' })
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

    return {
      id: updated.id,
      slug: updated.slug,
      verificationStatus: updated.verificationStatus,
    }
  },

  /**
   * Toggles an organizer's active state (enable/disable their account).
   * @param id - The organizer profile ID
   * @returns The organizer id and new isActive state
   * @throws 404 if organizer not found
   */
  async toggleActive(id: string) {
    const organizer = await organizerRepository.findByIdWithFullUser(id)

    if (!organizer) {
      throw createError({ statusCode: 404, statusMessage: 'Organizer not found' })
    }

    const updated = await userRepository.update(organizer.userId, {
      isActive: !organizer.user.isActive,
    })

    return {
      id: organizer.id,
      isActive: updated.isActive,
    }
  },

  /**
   * Verifies an organizer profile, transitioning it from PENDING to VERIFIED.
   * @param id - The organizer profile ID
   * @returns The updated profile with id and verificationStatus
   * @throws 404 if organizer not found, 409 if organizer is not in PENDING state
   */
  async verify(id: string) {
    const organizer = await organizerRepository.findById(id)

    if (!organizer) {
      throw createError({ statusCode: 404, statusMessage: 'Organizer not found' })
    }

    if (organizer.verificationStatus !== 'PENDING') {
      throw createError({ statusCode: 409, statusMessage: 'Organizer is not in pending state' })
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
