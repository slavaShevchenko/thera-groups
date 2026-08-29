import { z } from 'zod'

const questionSchema = z.object({
  id: z.string().optional(),
  question: z.string().min(1).max(500),
  type: z.enum(['TEXT', 'SINGLE_CHOICE', 'MULTIPLE_CHOICE']),
  required: z.boolean().default(false),
  options: z.array(z.string()).max(10).default([]),
})

// Для публикации — строгая валидация
export const publishGroupSchema = z.object({
  title: z.string().min(3).max(200),
  description: z.string().min(100).max(5000),
  type: z.enum([
    'THERAPEUTIC', 'WORKSHOP', 'SEMINAR', 'LECTURE', 'LECTURE_COURSE',
    'INTENSIVE', 'AUTHOR_PROGRAM', 'SUPERVISION', 'CONFERENCE',
    'CERTIFICATION', 'SPECIALIZATION', 'FOUNDATION', 'ADVANCED',
    'PROFESSIONAL', 'MODULAR', 'PARTNERSHIP', 'INTERNATIONAL', 'PILOT', 'OTHER',
  ]),
  format: z.enum(['ONLINE', 'OFFLINE', 'HYBRID']),
  startDate: z.string().datetime(),
})

// Для создания черновика — минимум полей
export const createDraftSchema = z.object({
  type: z.enum([
    'THERAPEUTIC', 'WORKSHOP', 'SEMINAR', 'LECTURE', 'LECTURE_COURSE',
    'INTENSIVE', 'AUTHOR_PROGRAM', 'SUPERVISION', 'CONFERENCE',
    'CERTIFICATION', 'SPECIALIZATION', 'FOUNDATION', 'ADVANCED',
    'PROFESSIONAL', 'MODULAR', 'PARTNERSHIP', 'INTERNATIONAL', 'PILOT', 'OTHER',
  ]).default('THERAPEUTIC'),
  format: z.enum(['ONLINE', 'OFFLINE', 'HYBRID']).default('ONLINE'),
})

// Для PATCH — все поля опциональные
export const updateGroupSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().min(1).max(5000).optional(),
  type: z.enum([
    'THERAPEUTIC', 'WORKSHOP', 'SEMINAR', 'LECTURE', 'LECTURE_COURSE',
    'INTENSIVE', 'AUTHOR_PROGRAM', 'SUPERVISION', 'CONFERENCE',
    'CERTIFICATION', 'SPECIALIZATION', 'FOUNDATION', 'ADVANCED',
    'PROFESSIONAL', 'MODULAR', 'PARTNERSHIP', 'INTERNATIONAL', 'PILOT', 'OTHER',
  ]).optional(),
  format: z.enum(['ONLINE', 'OFFLINE', 'HYBRID']).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  time: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  location: z.string().optional(),
  price: z.number().min(0).optional().nullable(),
  maxParticipants: z.number().int().min(1).optional().nullable(),
  tagIds: z.array(z.string()).max(5).optional(),
  questions: z.array(questionSchema).optional(),
  status: z.enum(['DRAFT', 'PENDING_REVIEW', 'PUBLISHED']).optional(),
  coOrganizers: z.array(z.object({
    userId: z.string(),
    role: z.string().max(100).default(''),
  })).max(10).optional(),
})
