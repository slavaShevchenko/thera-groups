import { z } from 'zod'
import { GROUP_TYPES } from '~~/shared/constants/groupTypes'

const groupTypeValues = GROUP_TYPES.map(t => t.value) as [string, ...string[]]

const questionSchema = z.object({
  id: z.string().optional(),
  question: z.string().min(1).max(500),
  type: z.enum(['TEXT', 'SINGLE_CHOICE', 'MULTIPLE_CHOICE']),
  required: z.boolean().default(false),
  options: z.array(z.string()).max(10).default([]),
})

// PATCH — all fields optional
export const updateGroupSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().min(1).max(5000).optional(),
  type: z.enum(groupTypeValues).optional(),
  format: z.enum(['ONLINE', 'OFFLINE', 'HYBRID']).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  location: z.string().optional(),
  priceAmount: z.number().min(0).optional().nullable(),
  currency: z.enum(['UAH', 'USD', 'EUR']).optional(),
  maxParticipants: z.number().int().min(1).optional().nullable(),
  tagIds: z.array(z.string()).max(5).optional(),
  questions: z.array(questionSchema).optional(),
  status: z.enum(['DRAFT', 'PENDING_REVIEW', 'PUBLISHED']).optional(),
  coOrganizers: z.array(z.object({
    userId: z.string(),
    role: z.string().max(100).default(''),
  })).max(10).optional(),
})

export type UpdateGroupInput = z.infer<typeof updateGroupSchema>
