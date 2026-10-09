import { z } from 'zod'

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
  organizerData: z.object({
    firstName: z.string().min(2).max(100),
    lastName: z.string().min(2).max(100),
    bio: z.string().max(2000).optional(),
    qualification: z.string().max(500).optional(),
  }).optional(),
})

export const loginSchema = z.object({
  email: emailSchema.max(255),
  password: z.string().min(1),
})

export const googleStartQuerySchema = z.object({
  locale: z.enum(['ua', 'en']).default('ua'),
  // Whether this OAuth sign-up should also open an organizer profile. It has to be an
  // explicit choice: creating one for every Google sign-in put plain visitors into the
  // verification queue.
  role: z.enum(['visitor', 'organizer']).default('visitor'),
})

export type GoogleSignupRole = 'visitor' | 'organizer'
