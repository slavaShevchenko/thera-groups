import { z } from 'zod'
import { GROUP_TYPES } from '~~/shared/constants/groupTypes'
import { GROUP_LIMITS } from '~~/shared/constants/limits'

const groupTypeValues = GROUP_TYPES.map(t => t.value) as [string, ...string[]]

const questionSchema = z.object({
  id: z.string().optional(),
  question: z.string().trim().min(1).max(GROUP_LIMITS.QUESTION_TEXT_MAX),
  type: z.enum(['TEXT', 'SINGLE_CHOICE', 'MULTIPLE_CHOICE']),
  required: z.boolean().default(false),
  options: z.array(z.string().max(200)).max(10).default([]),
})

// PATCH — all fields optional
export const updateGroupSchema = z.object({
  title: z.string().trim().min(1).max(GROUP_LIMITS.TITLE_MAX).optional(),
  description: z.string().trim().min(1).max(GROUP_LIMITS.DESCRIPTION_MAX).optional(),
  program: z.string().trim().max(GROUP_LIMITS.PROGRAM_MAX).optional(),
  type: z.enum(groupTypeValues).optional(),
  format: z.enum(['ONLINE', 'OFFLINE', 'HYBRID']).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  location: z.string().max(200).optional(),
  priceAmount: z.number().min(0).optional().nullable(),
  currency: z.enum(['UAH', 'USD', 'EUR']).optional(),
  maxParticipants: z.number().int().min(1).optional().nullable(),
  minParticipants: z.number().int().positive().optional().nullable(),
  durationHours: z.number().int().positive().optional().nullable(),
  certificateIssued: z.boolean().optional().nullable(),
  tagIds: z.array(z.string().min(1).max(50)).max(20).optional(),
  questions: z.array(questionSchema).optional(),
  status: z.enum(['DRAFT', 'PENDING_REVIEW', 'PUBLISHED']).optional(),
  coOrganizers: z.array(z.object({
    userId: z.string().min(1).max(50),
    role: z.string().max(100).default(''),
  })).max(10).optional(),
}).superRefine((data, ctx) => {
  if (data.startDate && data.endDate && new Date(data.endDate) <= new Date(data.startDate)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['endDate'],
      message: 'End date must be after start date',
    })
  }

  // Only checkable when both bounds travel in the same patch — the stored
  // maximum is not visible to the schema.
  if (
    data.minParticipants != null
    && data.maxParticipants != null
    && data.minParticipants > data.maxParticipants
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['minParticipants'],
      message: 'Minimum number of participants cannot exceed the maximum',
    })
  }
})

export type UpdateGroupInput = z.infer<typeof updateGroupSchema>
