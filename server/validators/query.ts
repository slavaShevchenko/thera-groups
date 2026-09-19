import { z } from 'zod'

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
})

export const groupsQuerySchema = paginationQuerySchema.extend({
  q: z.string().optional(),
  type: z.string().optional(),
  format: z.string().optional(),
  dateFrom: z.string().optional(),
})

export const organizersQuerySchema = z.object({
  city: z.string().optional(),
  format: z.string().optional(),
})

export const organizerSearchQuerySchema = z.object({
  q: z.string().min(2),
  exclude: z.string().optional(),
})

export const adminApplicationsQuerySchema = z.object({
  status: z.string().optional(),
  groupId: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
})

export const adminOrganizersQuerySchema = paginationQuerySchema

export const adminUsersQuerySchema = paginationQuerySchema

export const adminGroupsQuerySchema = paginationQuerySchema.extend({
  status: z.string().optional(),
})

export const groupApplicationsQuerySchema = z.object({
  status: z.string().optional(),
  orderBy: z.enum(['createdAt', 'status']).default('createdAt'),
})
