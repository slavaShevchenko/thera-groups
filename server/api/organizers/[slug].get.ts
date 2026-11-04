import { getUser } from '../../utils/auth'
import { organizerRepository } from '../../repositories/organizerRepository'
import { apiError } from '../../utils/apiError'
import { ErrorCodes } from '../../utils/errorCodes'
import { mapGroupCard } from '../../utils/groupResponse'
import { can } from '~~/shared/utils/permissions'

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug')

  if (!slug) {
    throw apiError(400, ErrorCodes.VALIDATION_FAILED, 'Slug is required')
  }

  const profile = await organizerRepository.findBySlugWithGroups(slug)

  if (!profile) {
    throw apiError(404, ErrorCodes.NOT_FOUND, 'Organizer not found')
  }

  // `can()` rather than a hand-rolled role check: `docs/api.md` has named
  // `organizer.profile.view` as this endpoint's permission since before the handler
  // consulted it, and a rule nobody calls is a rule nobody can rely on. The resource
  // carries no owner id, so `isOwner` is false and the verdict is exactly "VERIFIED for
  // anybody, otherwise ADMIN" — unchanged behaviour. The owner of a pending profile is
  // deliberately not admitted to the public page; they read and edit it at `/profile`.
  //
  // The session is resolved only on the branch that needs it. A VERIFIED profile is public
  // by definition, and paying a GoTrue round-trip plus a `User` query to confirm that
  // nobody is signed in would tax one of the hottest reads on the site.
  if (profile.verificationStatus !== 'VERIFIED') {
    const currentUser = await getUser(event)

    const allowed = can(
      'organizer.profile.view',
      currentUser,
      { verificationStatus: profile.verificationStatus },
    )

    if (!allowed) {
      throw apiError(404, ErrorCodes.NOT_FOUND, 'Organizer not found')
    }
  }

  return {
    // The slug, not the profile cuid: it is the only identifier a public page needs, and
    // the cuid was reachable by any anonymous visitor for no reason.
    id: profile.slug,
    slug: profile.slug,
    firstName: profile.firstName,
    lastName: profile.lastName,
    avatarUrl: profile.avatarUrl,
    bio: profile.bio,
    qualification: profile.qualification,
    experienceYears: profile.experienceYears,
    languages: profile.languages,
    workFormats: profile.workFormats,
    city: profile.city,
    education: profile.education,
    professionalOrganization: profile.professionalOrganization,
    professionalOrganizationStatus: profile.professionalOrganizationStatus,
    telegramUrl: profile.telegramUrl,
    instagramUrl: profile.instagramUrl,
    linkedinUrl: profile.linkedinUrl,
    whatsappUrl: profile.whatsappUrl,
    facebookUrl: profile.facebookUrl,
    youtubeUrl: profile.youtubeUrl,
    verificationStatus: profile.verificationStatus,
    specializations: profile.specializations,
    groups: profile.groups.map(mapGroupCard),
  }
})
