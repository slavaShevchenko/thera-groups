import { z } from 'zod'

export const registerSchema = z.object({
  email: z.string().email().min(5).max(255),
  password: z.string().min(8).max(100),
  role: z.enum(['VISITOR', 'THERAPIST']),
  preferredLocale: z.enum(['ua', 'en']).default('ua'),
  therapistData: z.object({
    firstName: z.string().min(2).max(100),
    lastName: z.string().min(2).max(100),
    bio: z.string().optional(),
    qualification: z.string().optional(),
  }).optional(),
})

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
})
