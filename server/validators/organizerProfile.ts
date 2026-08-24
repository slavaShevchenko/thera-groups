import { z } from 'zod'

const urlSchema = z.string().url().optional().or(z.literal(''))

export const updateOrganizerProfileSchema = z.object({
  firstName: z.string().min(2).max(100).optional(),
  lastName: z.string().min(2).max(100).optional(),
  bio: z.string().max(2000).optional().or(z.literal('')),
  qualification: z.string().max(200).optional().or(z.literal('')),
  experienceYears: z.number().int().min(0).max(50).optional().nullable(),
  languages: z.array(z.string()).optional(),
  workFormats: z.array(z.string()).optional(),
  city: z.string().max(100).optional().or(z.literal('')),
  education: z.string().max(500).optional().or(z.literal('')),
  telegramUrl: urlSchema,
  instagramUrl: urlSchema,
  linkedinUrl: urlSchema,
  specializationIds: z.array(z.string()).optional(),
  customSpecializations: z.array(z.string()).optional(),
})
