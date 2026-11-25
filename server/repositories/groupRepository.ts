import type { Filters } from '~~/types'
import type { Prisma, GroupStatus, QuestionType } from '@prisma/client'
import ISO6391 from 'iso-639-1'
import { prisma } from '../utils/prisma'
import { SITE_TIMEZONE, startOfSiteDay } from '../utils/siteTime'
import { GROUP_TYPES } from '~~/shared/constants/groupTypes'
import { PUBLIC_GROUP_STATUSES, COMPLETED_GROUP_STATUS, isPublicGroupStatus } from '~~/shared/constants/groupStatus'
import { ValidationError } from '../utils/domainErrors'
import type { PrismaClientOrTx } from './types'

const coOrganizersInclude = {
  include: {
    user: {
      select: {
        id: true,
        organizerProfile: {
          select: {
            firstName: true,
            lastName: true,
            avatarUrl: true,
            slug: true,
          },
        },
      },
    },
  },
}

const listInclude = {
  organizer: {
    select: {
      firstName: true,
      lastName: true,
      avatarUrl: true,
    },
  },
  coOrganizers: coOrganizersInclude,
  tags: true,
}

/**
 * Exactly the columns `mapGroupCard` renders, and no others.
 *
 * `listInclude` is an `include`, which ships every scalar column of the row alongside the
 * relations — `organizerId`, `timezone`, `description`, `program` and the group's own cuid.
 * The list endpoints get away with that because `mapGroupCard` re-picks on the way out, so
 * the surplus never reaches a response. This is for reads where a caller could return the
 * row without a mapper in between: there, what the query selects *is* the contract.
 */
const cardSelect = {
  slug: true,
  title: true,
  type: true,
  format: true,
  location: true,
  startsAt: true,
  endsAt: true,
  capacity: true,
  priceAmount: true,
  currency: true,
  status: true,
  organizer: {
    select: {
      firstName: true,
      lastName: true,
      avatarUrl: true,
    },
  },
  coOrganizers: coOrganizersInclude,
} as const

const activeOrganizerFilter = {
  organizer: {
    user: {
      isActive: true,
    },
  },
}

const VALID_TYPES = GROUP_TYPES.map(t => t.value)

const VALID_FORMATS = ['ONLINE', 'OFFLINE', 'HYBRID']

/**
 * Everything a visitor is allowed to see, and nothing about dates.
 *
 * The status used to be `PUBLISHED` alone, so the moment a group filled up it vanished
 * from the catalog, the home page, its own detail URL and the sitemap — and since nothing
 * ever moved `FULL` back, a bookmarked or indexed page was gone for good. `FULL` and
 * `COMPLETED` stay listed with a badge instead; `applicationService` is what refuses them.
 *
 * No `startsAt` floor here either. The catalog used to hide past events while the detail
 * lookup did not, which left every indexed URL for a started group pointing at a page the
 * catalog no longer admitted. Visibility is now decided by status alone and identically
 * everywhere; `findPublished` sorts what is still open above the archive instead of
 * dropping it.
 */
function buildPublishedWhere(filters?: Filters) {
  const where: Record<string, unknown> = {
    status: { in: PUBLIC_GROUP_STATUSES },
    ...activeOrganizerFilter,
  }

  if (filters?.q?.trim()) {
    where.title = { contains: filters.q.trim(), mode: 'insensitive' }
  }

  if (filters?.type) {
    if (!VALID_TYPES.includes(filters.type)) {
      throw new ValidationError(`Invalid type filter: ${filters.type}`, 'type')
    }
    where.type = filters.type
  }

  if (filters?.format) {
    if (!VALID_FORMATS.includes(filters.format)) {
      throw new ValidationError(`Invalid format filter: ${filters.format}`, 'format')
    }
    where.format = filters.format
  }

  if (filters?.dateFrom) {
    // A bare `YYYY-MM-DD` from a date input, read as the start of that day in the site
    // zone rather than as UTC midnight — see `startOfSiteDay`.
    const date = startOfSiteDay(filters.dateFrom)
    if (!date) {
      throw new ValidationError(`Invalid dateFrom format: ${filters.dateFrom}`, 'dateFrom')
    }
    where.startsAt = { gte: date }
  }

  if (filters?.languages?.length) {
    // Checked here as well as in `groupsQuerySchema`, for the same reason `type` and
    // `format` are: `findPublished` has callers that never went through that schema, and an
    // unvalidated array handed to Prisma is a filter that quietly matches nothing.
    const invalid = filters.languages.find(code => !ISO6391.validate(code))
    if (invalid) {
      throw new ValidationError(`Invalid language filter: ${invalid}`, 'languages')
    }
    // `hasSome` is the overlap operator (`&&`): a group qualifies by running in ANY of the
    // requested languages, which is what a visitor ticking two boxes means.
    where.languages = { hasSome: filters.languages }
  }

  return where
}

/**
 * The SQL half of the date predicates in `shared/utils/groupVisibility.ts`, so "ended",
 * "running now" and "still to come" cannot drift from the badge and the apply gate that
 * read the shared functions.
 *
 * A group is over when a person marked it `COMPLETED` or when `endsAt` passed — and only
 * then. A start date with no end date is open-ended, so it stays in the ongoing tier until
 * somebody closes it. NULL matches no comparison, so the arms below name the nulls
 * explicitly wherever a row without dates must not fall out of the catalog.
 *
 * Every arm is annotated `Prisma.GroupWhereInput` rather than left to inference: an array of
 * differently shaped object literals is normalized into a union, and normalization widens
 * the `COMPLETED_GROUP_STATUS` literal to `string`, which the `status` filter then refuses.
 */
function endedWhere(now: Date): Prisma.GroupWhereInput {
  return { OR: [{ status: COMPLETED_GROUP_STATUS }, { endsAt: { lt: now } }] }
}

/** The two arms of "not ended", spelled out so the tiers below can extend them flat. */
function notEndedArms(now: Date): Prisma.GroupWhereInput[] {
  return [
    { status: { not: COMPLETED_GROUP_STATUS } },
    { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
  ]
}

/** The exact complement of `endedWhere`: still to come, running right now, or open-ended. */
function notEndedWhere(now: Date): Prisma.GroupWhereInput {
  return { AND: notEndedArms(now) }
}

/** The SQL half of `isOngoingGroup()`: begun and not finished. */
function ongoingWhere(now: Date): Prisma.GroupWhereInput {
  return { AND: [...notEndedArms(now), { startsAt: { lt: now } }] }
}

/** The SQL half of "not ended and not begun", including a group with no dates at all. */
function upcomingWhere(now: Date): Prisma.GroupWhereInput {
  return {
    AND: [...notEndedArms(now), { OR: [{ startsAt: null }, { startsAt: { gte: now } }] }],
  }
}

/**
 * The three tiers of catalog ordering: groups running now first, most recently started
 * first; then events that have not begun, soonest first; then the archive, most recent
 * first.
 *
 * Prisma has no computed `ORDER BY`, so `ORDER BY tier, startsAt` is not expressible and one
 * page is assembled from three queries instead. The split is by *ended*, not by *started*,
 * so a group running this week stays above the archive instead of being filed into it —
 * which is what `startsAt` alone did. A `COMPLETED` row is in the archive by decision
 * whatever its `endsAt` reads, because an organizer who closes a group early leaves an end
 * date still in the future. An open-ended group is its own tier for the same reason from
 * the other side: sorted with the upcoming events it would sit above every one of them
 * forever, since nothing outranks a start date a year old. A visitor-supplied `dateFrom`
 * floor sits in `base` and stays ANDed on top, so an explicit filter still wins.
 *
 * Nulls are placed explicitly because `compareGroupsForListing` sorts a one-query list by
 * the same rule, and Postgres' defaults differ between ASC and DESC.
 */
function buildDateBuckets(base: Record<string, unknown>, now: Date) {
  return {
    ongoing: {
      where: { ...base, ...ongoingWhere(now) },
      orderBy: { startsAt: { sort: 'desc' as const, nulls: 'last' as const } },
    },
    upcoming: {
      where: { ...base, ...upcomingWhere(now) },
      orderBy: { startsAt: { sort: 'asc' as const, nulls: 'last' as const } },
    },
    past: {
      where: { ...base, ...endedWhere(now) },
      orderBy: { startsAt: { sort: 'desc' as const, nulls: 'last' as const } },
    },
  }
}

export const groupRepository = {
  async create(data: {
    organizerId: string
    title: string
    slug: string
    description?: string
    status?: string
  }, tx: PrismaClientOrTx = prisma) {
    return (tx as PrismaClientOrTx).group.create({
      data: {
        organizerId: data.organizerId,
        title: data.title,
        slug: data.slug,
        description: data.description ?? '',
        status: (data.status ?? 'DRAFT') as GroupStatus,
        // `POST /api/groups` creates an empty DRAFT and sends no timezone, so this is what a
        // real group is born with. It has to be a zone the form's dropdown offers — a value
        // outside it renders as an empty select that silently saves itself back.
        timezone: SITE_TIMEZONE,
      },
    })
  },

  async slugExists(slug: string): Promise<boolean> {
    const group = await prisma.group.findUnique({ where: { slug } })
    return !!group
  },

  async findBySlugForEdit(slug: string) {
    return prisma.group.findUnique({
      where: { slug },
      include: {
        organizer: true,
        tags: true,
        questions: { orderBy: { position: 'asc' } },
        coOrganizers: {
          include: {
            user: {
              select: {
                id: true,
                organizerProfile: {
                  select: { firstName: true, lastName: true, avatarUrl: true, slug: true },
                },
              },
            },
          },
        },
        _count: { select: { applications: true } },
      },
    })
  },

  async findBySlugWithOrganizer(slug: string) {
    return prisma.group.findUnique({
      where: { slug },
      include: { organizer: true },
    })
  },

  async findMyOwnedGroups(organizerId: string) {
    return prisma.group.findMany({
      where: { organizerId },
      include: { coOrganizers: coOrganizersInclude, _count: { select: { applications: true } } },
      orderBy: { createdAt: 'desc' },
    })
  },

  async findCoOrganizedGroups(userId: string, excludeOrganizerId?: string) {
    return prisma.group.findMany({
      where: {
        coOrganizers: { some: { userId } },
        ...(excludeOrganizerId ? { organizerId: { not: excludeOrganizerId } } : {}),
      },
      include: {
        organizer: { select: { userId: true, firstName: true, lastName: true, avatarUrl: true, slug: true } },
        coOrganizers: coOrganizersInclude,
        _count: { select: { applications: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
  },

  async findWithCoOrganizers(slug: string) {
    return prisma.group.findFirst({
      where: { slug },
      include: {
        organizer: { select: { id: true, userId: true } },
        coOrganizers: { select: { userId: true } },
      },
    })
  },

  async findByIdWithOrganizer(id: string) {
    return prisma.group.findUnique({
      where: { id },
      include: { organizer: true },
    })
  },

  async hasCoOrganizer(groupId: string, userId: string): Promise<boolean> {
    const count = await prisma.groupCoOrganizer.count({
      where: { groupId, userId },
    })
    return count > 0
  },

  async deleteById(id: string) {
    return prisma.group.delete({ where: { id } })
  },

  /**
   * Locks one group row and reads its seat state back, in one statement.
   *
   * Approving an applicant is a read-modify-write of "how many seats are taken". Under the
   * default READ COMMITTED isolation two approvals racing on the same group both count the
   * same number, both pass the capacity check and both write — the group ends up over
   * capacity with no error anywhere. Taking the row lock first makes the loser wait here
   * until the winner commits, and because READ COMMITTED gives each *statement* a fresh
   * snapshot, the count it runs afterwards sees the approval that beat it.
   *
   * Raw SQL because Prisma expresses no `FOR UPDATE`. Meaningless outside a transaction —
   * the lock is released the instant the statement ends — so `tx` is required in practice.
   * @param id - The group ID
   * @param tx - The transaction that must own the lock
   * @returns The group's current status and capacity, or null if it no longer exists
   */
  async lockById(id: string, tx: PrismaClientOrTx = prisma) {
    const rows = await (tx as PrismaClientOrTx).$queryRaw<
      Array<{ status: GroupStatus, capacity: number | null }>
    >`SELECT status, capacity FROM "Group" WHERE id = ${id} FOR UPDATE`

    return rows[0] ?? null
  },

  /**
   * Finds publicly visible groups with optional filters and pagination.
   *
   * Ordering is three-tier: groups running now first, most recently started first, then
   * events that have not begun soonest first, then the archive most recent first. A page
   * that reaches past one tier fills up from the next instead of stopping short.
   * See `buildDateBuckets`.
   * @param filters - Optional search, type, format, and date filters
   * @param pagination - Optional skip/take parameters
   * @returns Array of visible groups with organizer, co-organizers, and tags
   */
  async findPublished(filters?: Filters, pagination?: { skip?: number, take?: number }) {
    const base = buildPublishedWhere(filters)
    const { take = 100, skip = 0 } = pagination ?? {}
    const buckets = buildDateBuckets(base, new Date())

    // The totals only exist to place a `skip` that starts inside a later tier. On the first
    // page every offset is 0 whichever tier leads, so page one does not pay for two counts.
    const ongoingTotal = skip > 0 ? await prisma.group.count({ where: buckets.ongoing.where }) : 0
    const upcomingTotal = skip > 0 ? await prisma.group.count({ where: buckets.upcoming.where }) : 0

    const ongoing = await prisma.group.findMany({
      where: buckets.ongoing.where,
      include: listInclude,
      orderBy: buckets.ongoing.orderBy,
      // Past the end of a tier Prisma simply returns fewer rows, so the skip needs no
      // clamping; `take` is capped by the room left on the page below.
      skip,
      take,
    })

    const roomAfterOngoing = take - ongoing.length
    if (roomAfterOngoing <= 0) return ongoing

    const upcoming = await prisma.group.findMany({
      where: buckets.upcoming.where,
      include: listInclude,
      orderBy: buckets.upcoming.orderBy,
      skip: Math.max(0, skip - ongoingTotal),
      take: roomAfterOngoing,
    })

    const room = roomAfterOngoing - upcoming.length
    if (room <= 0) return [...ongoing, ...upcoming]

    const archive = await prisma.group.findMany({
      where: buckets.past.where,
      include: listInclude,
      orderBy: buckets.past.orderBy,
      skip: Math.max(0, skip - ongoingTotal - upcomingTotal),
      take: room,
    })

    return [...ongoing, ...upcoming, ...archive]
  },

  /**
   * Counts publicly visible groups matching the given filters.
   *
   * Counted over the unsplit filter, not over the three ordering tiers: their union is
   * exactly this set, so the pagination total does not depend on where today falls.
   * @param filters - Optional search, type, format, and date filters
   * @returns Total count of matching visible groups
   */
  async countPublished(filters?: Filters) {
    const where = buildPublishedWhere(filters)
    return prisma.group.count({ where })
  },

  /**
   * Finds the most recently created upcoming groups, for the home page.
   *
   * Deliberately narrower than the catalog: this is a discovery surface, so an event that
   * has already ended is not something to invite a visitor to. "Ended" is the same
   * predicate the catalog tiers split on, so a group running right now — and an open-ended
   * one with no end date at all — is very much an invitation. `FULL` is invited to as well,
   * since a seat may free up; `COMPLETED` is not, because a person has already said the
   * event is over. Same visibility rule otherwise, and a group with no dates at all counts
   * as upcoming rather than being dropped.
   * @param limit - Maximum number of groups to return
   * @returns Array of latest upcoming groups ordered by creation date
   */
  async findLatest(limit: number) {
    const now = new Date()

    return prisma.group.findMany({
      where: {
        ...buildPublishedWhere(),
        ...notEndedWhere(now),
      },
      include: listInclude,
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
    })
  },

  /**
   * Finds a group by slug with full organizer, co-organizer, and tag details.
   * Non-privileged viewers only see publicly visible groups (returns null otherwise).
   * @param slug - The URL-friendly group identifier
   * @param viewer - Optional viewer context for status-based access control
   * @returns The group or null if not found / not accessible
   */
  async findBySlug(slug: string, viewer?: { userId?: string, role?: string }) {
    const group = await prisma.group.findFirst({
      where: {
        slug,
        ...activeOrganizerFilter,
      },
      include: {
        organizer: {
          select: {
            id: true,
            userId: true,
            firstName: true,
            lastName: true,
            slug: true,
            avatarUrl: true,
            bio: true,
            qualification: true,
            specializations: true,
            experienceYears: true,
            verificationStatus: true,
          },
        },
        coOrganizers: coOrganizersInclude,
        tags: true,
      },
    })

    if (!group) return null

    const isAdmin = viewer?.role === 'ADMIN'
    // `?.` rather than `!`: `Group.organizerId` is nullable and the FK is `ON DELETE SET
    // NULL`, so a row can outlive its organizer. `activeOrganizerFilter` above means that
    // cannot happen through this query today, but a group with no organizer has no owner,
    // and asserting otherwise turns a data state into a TypeError.
    const isOwner = viewer?.userId ? group.organizer?.userId === viewer.userId : false
    const isCoOrganizer = viewer?.userId
      ? group.coOrganizers.some(co => co.userId === viewer.userId)
      : false

    // Same rule as the catalog and the sitemap: a FULL or COMPLETED group keeps its page,
    // because it was published, indexed and bookmarked while it was taking applications.
    if (!isAdmin && !isOwner && !isCoOrganizer && !isPublicGroupStatus(group.status)) {
      return null
    }

    return group
  },

  /**
   * Finds a group by slug for update operations, including organizer and co-organizer user IDs for permission checks.
   * @param slug - The URL-friendly group identifier
   * @returns The group with minimal organizer/co-organizer data, or null if not found
   */
  async findBySlugForUpdate(slug: string) {
    return prisma.group.findFirst({
      where: { slug },
      include: {
        organizer: { select: { id: true, userId: true } },
        coOrganizers: { select: { userId: true } },
      },
    })
  },

  /**
   * Finds group tags by their IDs, optionally within a transaction.
   * @param ids - Array of tag IDs to look up
   * @param tx - Optional Prisma client or transaction context
   * @returns Array of matching group tags
   */
  async findTagsByIds(ids: string[], tx: PrismaClientOrTx = prisma) {
    return (tx as PrismaClientOrTx).groupTag.findMany({
      where: { id: { in: ids } },
    })
  },

  /**
   * Updates a group's data, optionally within a transaction.
   * @param id - The group ID
   * @param data - The Prisma update input
   * @param tx - Optional Prisma client or transaction context
   * @returns The updated group record
   */
  async update(id: string, data: Prisma.GroupUpdateInput, tx: PrismaClientOrTx = prisma) {
    return (tx as PrismaClientOrTx).group.update({ where: { id }, data })
  },

  /**
   * Finds a group by ID for admin moderation, selecting only moderation-relevant fields.
   * @param id - The group ID
   * @returns The group with id, status, title, and slug, or null if not found
   */
  async findByIdForModeration(id: string) {
    return prisma.group.findUnique({
      where: { id },
      select: { id: true, status: true, title: true, slug: true },
    })
  },

  /**
   * Updates a group's moderation status and rejection reason, including organizer locale for notifications.
   * @param id - The group ID
   * @param data - Object with status and optional rejectionReason
   * @returns The updated group with organizer user locale info
   */
  async updateForModeration(id: string, data: { status: GroupStatus, rejectionReason: string | null }) {
    return prisma.group.update({
      where: { id },
      data,
      include: {
        organizer: {
          select: {
            userId: true,
            user: { select: { preferredLocale: true } },
          },
        },
      },
    })
  },

  /**
   * Finds all groups for admin panel with pagination, filtering, and organizer details.
   * @param options - Optional where filter, skip, and take parameters
   * @returns Object with groups array and total count
   */
  async findAllAdmin(options: {
    where?: Record<string, unknown>
    skip?: number
    take?: number
  } = {}) {
    const where = options.where ?? {}
    const skip = options.skip ?? 0
    const take = Math.min(options.take ?? 50, 100)

    const [groups, total] = await Promise.all([
      prisma.group.findMany({
        where: where as Prisma.GroupWhereInput,
        include: {
          organizer: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              slug: true,
              avatarUrl: true,
            },
          },
          coOrganizers: coOrganizersInclude,
        },
        orderBy: { updatedAt: 'desc' },
        skip,
        take,
      }),
      prisma.group.count({ where: where as Prisma.GroupWhereInput }),
    ])

    return { groups, total }
  },

  /**
   * Deletes all application questions for a group, optionally within a transaction.
   * @param groupId - The group ID
   * @param tx - Optional Prisma client or transaction context
   * @returns Count of deleted questions
   */
  async deleteQuestionsByGroup(groupId: string, tx: PrismaClientOrTx = prisma) {
    return (tx as PrismaClientOrTx).applicationQuestion.deleteMany({
      where: { groupId },
    })
  },

  /**
   * Bulk-creates application questions for a group, optionally within a transaction.
   * @param groupId - The group ID
   * @param questions - Array of question data (question text, type, required, options, position)
   * @param tx - Optional Prisma client or transaction context
   * @returns Count of created questions
   */
  async createQuestionsMany(groupId: string, questions: Array<{
    question: string
    type: QuestionType
    required: boolean
    options: string[]
    position: number
  }>, tx: PrismaClientOrTx = prisma) {
    return (tx as PrismaClientOrTx).applicationQuestion.createMany({
      data: questions.map(q => ({
        groupId,
        question: q.question,
        type: q.type,
        required: q.required,
        options: q.options,
        position: q.position,
      })),
    })
  },

  /**
   * Deletes all co-organizers for a group, optionally within a transaction.
   * @param groupId - The group ID
   * @param tx - Optional Prisma client or transaction context
   * @returns Count of deleted co-organizers
   */
  async deleteCoOrganizersByGroup(groupId: string, tx: PrismaClientOrTx = prisma) {
    return (tx as PrismaClientOrTx).groupCoOrganizer.deleteMany({
      where: { groupId },
    })
  },

  /**
   * Bulk-creates co-organizers for a group, optionally within a transaction.
   * @param groupId - The group ID
   * @param coOrganizers - Array of co-organizer data (userId, role, sortOrder)
   * @param tx - Optional Prisma client or transaction context
   * @returns Count of created co-organizers
   */
  async createCoOrganizersMany(groupId: string, coOrganizers: Array<{
    userId: string
    role: string
    sortOrder: number
  }>, tx: PrismaClientOrTx = prisma) {
    return (tx as PrismaClientOrTx).groupCoOrganizer.createMany({
      data: coOrganizers.map(c => ({
        groupId,
        userId: c.userId,
        role: c.role,
        sortOrder: c.sortOrder,
      })),
    })
  },

}

export { coOrganizersInclude, listInclude, cardSelect, activeOrganizerFilter, buildPublishedWhere }
