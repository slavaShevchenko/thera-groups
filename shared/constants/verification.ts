/**
 * What an organizer profile has to contain before an admin may verify it.
 *
 * Both creation paths now collect all three (`registerSchema.organizerData` and
 * `createOrganizerProfileSchema`), so a profile that reaches the queue is one an admin can
 * act on. The check stays, because creation is not the last word on these fields:
 * `updateOrganizerProfileSchema` deliberately lets an organizer clear any of them to `''`,
 * and rows created before registration asked for them are still in the database. Verifying
 * is the moment the platform vouches for somebody — it unlocks group creation and puts the
 * profile in the public catalog, where the profile page advertises exactly these fields.
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
