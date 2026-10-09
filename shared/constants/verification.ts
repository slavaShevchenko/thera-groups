/**
 * What an organizer profile has to contain before an admin may verify it.
 *
 * Registration collects only a name, a bio and a qualification, so every profile reaches
 * the review queue missing the two professional fields — and `updateOrganizerProfileSchema`
 * lets an organizer save one field at a time. Verifying is the moment the platform vouches
 * for somebody: it unlocks group creation and puts the profile in the public catalog, where
 * the profile page advertises exactly these fields.
 *
 * Enforced in `organizerService.moderateProfile`, not on every profile write, so a partial
 * autosave cannot fail on a field nobody was editing. Lives in `shared/` because the admin
 * queue has to say which fields are missing before it offers the button, and `app/` may not
 * import from `server/`.
 */
export const VERIFICATION_REQUIRED_FIELDS = [
  'qualification',
  'professionalOrganization',
  'professionalOrganizationStatus',
] as const

export type VerificationRequiredField = typeof VERIFICATION_REQUIRED_FIELDS[number]
