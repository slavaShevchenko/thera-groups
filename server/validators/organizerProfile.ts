import { z } from 'zod'
import ISO6391 from 'iso-639-1'
import { PROFILE_LIMITS } from '~~/shared/constants/limits'

const urlSchema = z.string().url().max(PROFILE_LIMITS.SOCIAL_URL_MAX).optional().or(z.literal(''))

/**
 * A required field on a PATCH schema means the client must resend the whole profile on
 * every write. These three used to be required, so an autosave that touched only `bio`
 * came back 400 naming fields nobody was editing — and the workaround, resending
 * everything, is how a stale tab silently overwrites a newer one.
 *
 * They are still *enforced*, just where the enforcement means something: an admin cannot
 * verify a profile that lacks them (`organizerService.moderateProfile`). Editing and
 * being complete enough to verify are different questions.
 *
 * An empty string clears; an omitted key leaves the stored value alone.
 */
const optionalText = (max: number) => z.string().trim().max(max).optional()

export const updateOrganizerProfileSchema = z.object({
  firstName: z.string().trim().min(2).max(PROFILE_LIMITS.FIRST_NAME_MAX).optional(),
  lastName: z.string().trim().min(2).max(PROFILE_LIMITS.LAST_NAME_MAX).optional(),
  bio: z.string().max(PROFILE_LIMITS.BIO_MAX).optional().or(z.literal('')),
  qualification: optionalText(PROFILE_LIMITS.QUALIFICATION_MAX),
  experienceYears: z.number().int().min(0).max(50).optional().nullable(),
  languages: z.array(z.string().max(2)).max(20).refine(
    codes => codes.every(code => ISO6391.validate(code)),
    { message: 'Invalid language code' },
  ).optional(),
  workFormats: z.array(z.string()).optional(),
  city: z.string().max(PROFILE_LIMITS.CITY_MAX).optional().or(z.literal('')),
  education: z.array(z.string().max(PROFILE_LIMITS.EDUCATION_MAX)).optional(),
  professionalOrganization: optionalText(PROFILE_LIMITS.PROFESSIONAL_ORG_MAX),
  professionalOrganizationStatus: optionalText(PROFILE_LIMITS.PROFESSIONAL_ORG_STATUS_MAX),
  telegramUrl: urlSchema,
  instagramUrl: urlSchema,
  linkedinUrl: urlSchema,
  whatsappUrl: urlSchema,
  facebookUrl: urlSchema,
  youtubeUrl: urlSchema,
  specializations: z.array(z.string().max(PROFILE_LIMITS.SPECIALIZATION_MAX)).max(20).optional(),
})

/**
 * The VISITOR → ORGANIZER step. It asks for a name because a profile without one has
 * nothing for an admin to review and no slug for the catalog to find it by — the same
 * fields `registerSchema.organizerData` collects. Everything else stays optional here and
 * is filled in on the edit form afterwards; completeness is judged at verification time
 * (`VERIFICATION_REQUIRED_FIELDS`), not at creation.
 */
export const createOrganizerProfileSchema = z.object({
  firstName: z.string().trim().min(2).max(PROFILE_LIMITS.FIRST_NAME_MAX),
  lastName: z.string().trim().min(2).max(PROFILE_LIMITS.LAST_NAME_MAX),
  qualification: optionalText(PROFILE_LIMITS.QUALIFICATION_MAX),
})
