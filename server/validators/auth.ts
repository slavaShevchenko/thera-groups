import { z } from 'zod'
import { PROFILE_LIMITS } from '~~/shared/constants/limits'
import { requiredText } from './organizerProfile'

/**
 * An address in the one form the server stores and compares it in — see
 * `server/utils/emailAddress.ts` for why a case difference is a security bug here and not
 * a cosmetic one. Trim and lower-case run *before* the format check so a pasted address
 * with surrounding whitespace is normalized rather than rejected.
 */
const emailSchema = z.string().trim().toLowerCase().email()

export const registerSchema = z.object({
  email: emailSchema.min(5).max(255),
  password: z.string().min(8).max(100),
  role: z.enum(['VISITOR', 'ORGANIZER']),
  preferredLocale: z.enum(['ua', 'en']).default('ua'),
  /**
   * Collected in full: a sign-up that opens a PENDING profile missing any of
   * `VERIFICATION_REQUIRED_FIELDS` puts an entry in the moderation queue that
   * `organizerService.moderateProfile` refuses to approve, and tells the organizer their
   * profile is "under review". `bio` stays optional — the admin is not gatekeeping on it,
   * the profile edit form is.
   */
  organizerData: z.object({
    firstName: requiredText(PROFILE_LIMITS.FIRST_NAME_MAX),
    lastName: requiredText(PROFILE_LIMITS.LAST_NAME_MAX),
    bio: z.string().max(PROFILE_LIMITS.BIO_MAX).optional(),
    qualification: requiredText(PROFILE_LIMITS.QUALIFICATION_MAX),
    professionalOrganization: requiredText(PROFILE_LIMITS.PROFESSIONAL_ORG_MAX),
    professionalOrganizationStatus: requiredText(PROFILE_LIMITS.PROFESSIONAL_ORG_STATUS_MAX),
  }).optional(),
})

export const loginSchema = z.object({
  email: emailSchema.max(255),
  password: z.string().min(1),
})

/**
 * Google is a sign-in, never a sign-up: `POST /api/auth/google` refuses an identity that
 * resolves to no local account. There is therefore nothing to choose before the redirect,
 * and the only parameter left is the locale the callback page has to land on.
 */
export const googleStartQuerySchema = z.object({
  locale: z.enum(['ua', 'en']).default('ua'),
})
