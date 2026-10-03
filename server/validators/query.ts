import { z } from 'zod'
import { GroupType, GroupFormat, GroupStatus, ApplicationStatus } from '@prisma/client'

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
})

export const groupsQuerySchema = paginationQuerySchema.extend({
  q: z.string().max(200).optional(),
  type: z.nativeEnum(GroupType).optional(),
  format: z.nativeEnum(GroupFormat).optional(),
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
})

export const organizersQuerySchema = paginationQuerySchema.extend({
  q: z.string().trim().max(100).optional(),
  city: z.string().max(100).optional(),
  format: z.nativeEnum(GroupFormat).optional(),
})

// `exclude` is a comma-separated list of user IDs, so it is bounded per ID and by
// count — never by total string length. The picker sends every picked co-organizer
// plus the owner and the current user; a length cap rejected the 3rd ID already.
export const MAX_EXCLUDE_IDS = 50

export const organizerSearchQuerySchema = z.object({
  q: z.string().min(2).max(200),
  exclude: z
    .string()
    .transform(value => value.split(',').map(id => id.trim()).filter(Boolean))
    .pipe(z.array(z.string().min(1).max(50)).max(MAX_EXCLUDE_IDS))
    .optional(),
})

export const adminApplicationsQuerySchema = paginationQuerySchema.extend({
  status: z.nativeEnum(ApplicationStatus).optional(),
  groupId: z.string().max(50).optional(),
})

export const adminOrganizersQuerySchema = paginationQuerySchema

export const adminUsersQuerySchema = paginationQuerySchema

export const adminGroupsQuerySchema = paginationQuerySchema.extend({
  status: z.nativeEnum(GroupStatus).optional(),
})

export const groupApplicationsQuerySchema = paginationQuerySchema.extend({
  status: z.nativeEnum(ApplicationStatus).optional(),
  orderBy: z.enum(['createdAt', 'status']).default('createdAt'),
})
