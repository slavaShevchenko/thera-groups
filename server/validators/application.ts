import { z } from 'zod'

export const applySchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email().max(255),
  phone: z.string().regex(/^\+?[\d\s()-]{7,20}$/).optional(),
  message: z.string().max(2000).optional(),
  answers: z.array(z.object({
    questionId: z.string(),
    value: z.string().max(2000),
  })).default([]),
})

export const applicationStatusSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED']),
})

export const applicationWithdrawSchema = z.object({
  reason: z.string().max(500).optional(),
})
