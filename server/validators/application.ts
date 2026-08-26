import { z } from 'zod'

export const applySchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email().max(255),
  phone: z.string().max(20).optional(),
  answers: z.array(z.object({
    questionId: z.string(),
    value: z.string().max(2000),
  })).default([]),
})

export const applicationStatusSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED']),
})
