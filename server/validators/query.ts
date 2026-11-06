import { z } from 'zod'
import ISO6391 from 'iso-639-1'
import { GroupType, GroupFormat, GroupStatus, ApplicationStatus } from '@prisma/client'
import { LIMITS } from '~~/shared/constants/limits'

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
})

export const groupsQuerySchema = paginationQuerySchema.extend({
  q: z.string().max(200).optional(),
  type: z.nativeEnum(GroupType).optional(),
  format: z.nativeEnum(GroupFormat).optional(),
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  /**
   * Comma-separated ISO 639-1 codes, OR-matched against `Group.languages`.
   *
   * Same `transform().pipe()` shape as `exclude` and the admin `status` list. Codes are
   * lowercased on the way in because that is how `slugify`-free ISO 639-1 is stored and how
   * the picker emits them, but a visitor typing `?languages=UK` into the address bar should
   * still get results.
   */
  languages: z
    .string()
    .transform(value => value.split(',').map(code => code.trim().toLowerCase()).filter(Boolean))
    .pipe(
      z.array(z.string().max(2))
        .max(LIMITS.LANGUAGE_CODES_MAX)
        .refine(codes => codes.every(code => ISO6391.validate(code)), {
          message: 'Invalid language code',
        }),
    )
    .optional(),
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

/**
 * `status` takes a comma-separated list because the admin panel reads statuses in views
 * rather than one at a time — "active" is `PUBLISHED` and `FULL` together, and both need to
 * be on screen for the actions on them to make sense. A single value still parses, as a
 * list of one, so existing callers and bookmarks are unaffected.
 */
export const adminGroupsQuerySchema = paginationQuerySchema.extend({
  status: z
    .string()
    .transform(value => value.split(',').map(part => part.trim()).filter(Boolean))
    .pipe(z.array(z.nativeEnum(GroupStatus)).min(1).max(Object.keys(GroupStatus).length))
    .optional(),
})

export const groupApplicationsQuerySchema = paginationQuerySchema.extend({
  status: z.nativeEnum(ApplicationStatus).optional(),
  orderBy: z.enum(['createdAt', 'status']).default('createdAt'),
})
