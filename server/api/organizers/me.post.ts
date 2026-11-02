import { requireAuth } from '../../utils/auth'
import { organizerRepository } from '../../repositories/organizerRepository'
import { userRepository } from '../../repositories/userRepository'
import { createOrganizerProfileSchema } from '../../validators/organizerProfile'
import { generateUniqueSlug } from '../../utils/slugify'
import { apiError } from '../../utils/apiError'
import { ErrorCodes } from '../../utils/errorCodes'
import { logHandlerError, mapPrismaError } from '../../utils/errorHandler'
import { notifyAdminsOrganizerPendingReview } from '../../utils/notifications'

/**
 * The VISITOR → ORGANIZER step, which until now only registration and the Google sign-up
 * could take: both create a PENDING profile while collecting the sign-up form, so an
 * already-registered visitor had no way to start organizing short of making a second
 * account.
 *
 * The profile is created PENDING for the same reason those two paths do it — the admin
 * queue only surfaces PENDING profiles and the PATCH schema never accepts
 * `verificationStatus` from a client, so an UNVERIFIED row created here would be a dead
 * end nobody can move. The organizer still has to fill the profile in on the edit form;
 * `organizerService.moderateProfile` refuses to verify one that is missing
 * `VERIFICATION_REQUIRED_FIELDS`.
 */
export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)

  const existing = await organizerRepository.findByUserId(user.id)

  if (existing) {
    throw apiError(409, ErrorCodes.CONFLICT, 'Organizer profile already exists')
  }

  const body = await readBody(event)

  const parsed = createOrganizerProfileSchema.safeParse(body)
  if (!parsed.success) {
    throw apiError(400, ErrorCodes.VALIDATION_FAILED, 'Validation failed', {
      issues: parsed.error.issues.map(i => ({
        path: i.path.join('.'),
        message: i.message,
      })),
    })
  }

  const { firstName, lastName, qualification } = parsed.data

  try {
    const slug = await generateUniqueSlug(
      `${firstName} ${lastName}`,
      candidate => organizerRepository.slugExists(candidate),
    )

    const created = await organizerRepository.create({
      user: { connect: { id: user.id } },
      firstName,
      lastName,
      qualification: qualification || null,
      slug,
      verificationStatus: 'PENDING',
    })

    // Promoted only after the profile exists, so a failed create can never leave a user
    // holding the ORGANIZER role with nothing to be verified. An ADMIN keeps its role.
    if (user.role === 'VISITOR') {
      await userRepository.update(user.id, { role: 'ORGANIZER' })
    }

    // The third path that opens a PENDING profile, and the admin queue only surfaces
    // PENDING — without this a visitor who promoted themselves waited on a moderation
    // nobody had been told about. Swallowed rather than awaited into the response: the
    // profile and the role are already durable, and a failure here would answer 500 for a
    // sign-up that succeeded, after which the retry can only return 409.
    await notifyAdminsOrganizerPendingReview(`${firstName} ${lastName}`, created.slug)
      .catch((error: unknown) => {
        logHandlerError(new Error('admin notification failed', { cause: error }), {
          source: 'organizers.me.post',
          event,
        })
      })

    return {
      id: created.id,
      slug: created.slug,
      firstName: created.firstName,
      lastName: created.lastName,
      bio: created.bio,
      qualification: created.qualification,
      avatarUrl: created.avatarUrl,
      experienceYears: created.experienceYears,
      languages: created.languages,
      workFormats: created.workFormats,
      city: created.city,
      education: created.education,
      professionalOrganization: created.professionalOrganization,
      professionalOrganizationStatus: created.professionalOrganizationStatus,
      telegramUrl: created.telegramUrl,
      instagramUrl: created.instagramUrl,
      linkedinUrl: created.linkedinUrl,
      whatsappUrl: created.whatsappUrl,
      facebookUrl: created.facebookUrl,
      youtubeUrl: created.youtubeUrl,
      verificationStatus: created.verificationStatus,
      rejectionReason: created.rejectionReason,
      specializations: created.specializations,
    }
  }
  catch (error) {
    if (error && typeof error === 'object' && 'statusCode' in error) throw error
    throw mapPrismaError(error, 'organizers.me.post')
  }
})
