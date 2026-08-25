import { z } from 'zod'

export const createGroupSchema = z.object({
  title: z.string().min(3).max(200),
  description: z.string().min(10).max(5000),
  categoryId: z.string().min(1),
  type: z.enum([
    'THERAPEUTIC', 'WORKSHOP', 'SEMINAR', 'LECTURE', 'LECTURE_COURSE',
    'INTENSIVE', 'AUTHOR_PROGRAM', 'SUPERVISION', 'CONFERENCE',
    'CERTIFICATION', 'SPECIALIZATION', 'FOUNDATION', 'ADVANCED',
    'PROFESSIONAL', 'MODULAR', 'PARTNERSHIP', 'INTERNATIONAL', 'PILOT', 'OTHER',
  ]),
  format: z.enum(['ONLINE', 'OFFLINE', 'HYBRID']),
  startDate: z.string().datetime(),
  endDate: z.string().datetime().optional(),
  time: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  location: z.string().optional(),
  price: z.number().min(0).optional().nullable(),
  maxParticipants: z.number().int().min(1).optional().nullable(),
  tagIds: z.array(z.string()).max(5).optional(),
})

export const updateGroupSchema = createGroupSchema.partial()
