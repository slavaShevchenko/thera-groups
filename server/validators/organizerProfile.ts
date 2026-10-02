import { z } from 'zod'
import ISO6391 from 'iso-639-1'
import { PROFILE_LIMITS } from '~~/shared/constants/limits'

const urlSchema = z.string().url().max(PROFILE_LIMITS.SOCIAL_URL_MAX).optional().or(z.literal(''))

export const updateOrganizerProfileSchema = z.object({
  firstName: z.string().trim().min(1).max(PROFILE_LIMITS.FIRST_NAME_MAX).optional(),
  lastName: z.string().trim().min(1).max(PROFILE_LIMITS.LAST_NAME_MAX).optional(),
  bio: z.string().max(PROFILE_LIMITS.BIO_MAX).optional().or(z.literal('')),
  qualification: z.string().trim().min(1).max(PROFILE_LIMITS.QUALIFICATION_MAX),
  experienceYears: z.number().int().min(0).max(50).optional().nullable(),
  languages: z.array(z.string().max(2)).max(20).refine(
    codes => codes.every(code => ISO6391.validate(code)),
    { message: 'Invalid language code' },
  ).optional(),
  workFormats: z.array(z.string()).optional(),
  city: z.string().max(PROFILE_LIMITS.CITY_MAX).optional().or(z.literal('')),
  education: z.array(z.string().max(PROFILE_LIMITS.EDUCATION_MAX)).default([]),
  professionalOrganization: z.string().trim().min(1).max(PROFILE_LIMITS.PROFESSIONAL_ORG_MAX),
  professionalOrganizationStatus: z.string().trim().min(1).max(PROFILE_LIMITS.PROFESSIONAL_ORG_STATUS_MAX),
  telegramUrl: urlSchema,
  instagramUrl: urlSchema,
  linkedinUrl: urlSchema,
  whatsappUrl: urlSchema,
  facebookUrl: urlSchema,
  youtubeUrl: urlSchema,
  specializations: z.array(z.string().max(PROFILE_LIMITS.SPECIALIZATION_MAX)).max(20).optional(),
})
