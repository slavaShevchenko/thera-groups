import { z } from 'zod'
import ISO6391 from 'iso-639-1'
import { GROUP_TYPES } from '~~/shared/constants/groupTypes'
import { GROUP_LIMITS, LIMITS } from '~~/shared/constants/limits'

const groupTypeValues = GROUP_TYPES.map(t => t.value) as [string, ...string[]]

const questionSchema = z.object({
  id: z.string().optional(),
  question: z.string().trim().min(1).max(GROUP_LIMITS.QUESTION_TEXT_MAX),
  type: z.enum(['TEXT', 'SINGLE_CHOICE', 'MULTIPLE_CHOICE']),
  required: z.boolean().default(false),
  options: z.array(z.string().max(GROUP_LIMITS.OPTION_TEXT_MAX)).max(10).default([]),
})

// POST /api/groups — creates the DRAFT the editor then fills in.
// `organizerId` is required from an ADMIN and ignored for everyone else, but the schema
// cannot express that: it never sees the session, so the handler decides.
//
// `title` is required because the slug is cut from it, and a slug is the one field on a group
// that can never be fixed later: renaming one moves a URL that is already indexed,
// sitemapped, hreflang-linked and written into `Notification.entityId`. Creation used to take
// an empty body and slug the draft `new-group`, which is how the first real published event
// ended up at `/ua/groups/new-group`.
//
// The floor is `GROUP_LIMITS.TITLE_MIN`, not the 1 that `updateGroupSchema.title` allows. The
// asymmetry is deliberate: this is one deliberate submit, gated by the same rule the editor's
// publish checklist uses, whereas a PATCH arrives from a debounced autosave that fires
// mid-typing and would 400 on every keystroke of a short title.
export const createGroupSchema = z.object({
  title: z.string().trim().min(GROUP_LIMITS.TITLE_MIN).max(GROUP_LIMITS.TITLE_MAX),
  organizerId: z.string().min(1).optional(),
})

// PATCH — all fields optional
export const updateGroupSchema = z.object({
  title: z.string().trim().min(1).max(GROUP_LIMITS.TITLE_MAX).optional(),
  description: z.string().trim().min(1).max(GROUP_LIMITS.DESCRIPTION_MAX).optional(),
  program: z.string().trim().max(GROUP_LIMITS.PROGRAM_MAX).optional(),
  type: z.enum(groupTypeValues).optional(),
  format: z.enum(['ONLINE', 'OFFLINE', 'HYBRID']).optional(),
  startDate: z.string().datetime().optional(),
  // null clears a stored end date; omitted leaves it untouched.
  endDate: z.string().datetime().optional().nullable(),
  // IANA timezone identifier (e.g. "Europe/Kyiv"). Not checked against `Intl` — the form only
  // offers the zones in the `timezones` locale dictionary, and the group page prints one it
  // cannot translate as the bare identifier rather than as a missing-key string.
  timezone: z.string().max(50).optional(),
  location: z.string().max(GROUP_LIMITS.LOCATION_MAX).optional(),
  // ISO 639-1 codes, validated exactly as `updateOrganizerProfileSchema.languages` does and
  // against the same ceiling, so the two columns cannot accept different vocabularies.
  //
  // Deliberately absent from `CRITICAL_FIELDS` in groupService: changing the languages an
  // event runs in leaves a published group published, the way `program` does.
  languages: z.array(z.string().max(2)).max(LIMITS.LANGUAGE_CODES_MAX).refine(
    codes => codes.every(code => ISO6391.validate(code)),
    { message: 'Invalid language code' },
  ).optional(),
  priceAmount: z.number().min(0).optional().nullable(),
  currency: z.enum(['UAH', 'USD', 'EUR']).optional(),
  maxParticipants: z.number().int().min(1).optional().nullable(),
  minParticipants: z.number().int().positive().optional().nullable(),
  durationHours: z.number().int().positive().optional().nullable(),
  certificateIssued: z.boolean().optional().nullable(),
  tagIds: z.array(z.string().min(1).max(50)).max(20).optional(),
  questions: z.array(questionSchema).optional(),
  // `FULL` is absent on purpose: only `applicationService` sets it, when approvals reach
  // capacity. `CANCELLED` and `COMPLETED` are owner/admin-only and checked in
  // `groupService.validateStatusTransition`, which is the only place that knows who is asking.
  status: z.enum(['DRAFT', 'PENDING_REVIEW', 'PUBLISHED', 'COMPLETED', 'CANCELLED']).optional(),
  // Reassigning the owner is ADMIN-only and the handler drops it for everybody else, but it
  // still has to be *shaped* here: read off the raw body it arrived as an unchecked cast, so
  // an object or a 10 kB string went straight into a `findByUserId`.
  //
  // This is a **user** id — the admin edit page picks the new owner from the co-organizer
  // list, which is keyed by user. `createGroupSchema.organizerId` is a profile id, because
  // that page's picker lists profiles. Same name, two vocabularies, both resolved server-side.
  organizerId: z.string().min(1).max(50).optional(),
  coOrganizers: z.array(z.object({
    userId: z.string().min(1).max(50),
    role: z.string().max(GROUP_LIMITS.CO_ORGANIZER_ROLE_MAX).default(''),
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
