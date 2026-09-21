import type { Filters } from '~~/types'
import type { Prisma, GroupStatus, QuestionType } from '@prisma/client'
import { prisma } from '../utils/prisma'
import { GROUP_TYPES } from '~~/shared/constants/groupTypes'
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

const activeOrganizerFilter = {
  organizer: {
    user: {
      isActive: true,
    },
  },
}

const VALID_TYPES = GROUP_TYPES.map(t => t.value)

const VALID_FORMATS = ['ONLINE', 'OFFLINE', 'HYBRID']

function buildPublishedWhere(filters?: Filters) {
  const where: Record<string, unknown> = {
    status: 'PUBLISHED',
    ...activeOrganizerFilter,
    startsAt: { gte: new Date() },
  }

  if (filters?.q?.trim()) {
    where.title = { contains: filters.q.trim(), mode: 'insensitive' }
  }

  if (filters?.type && VALID_TYPES.includes(filters.type)) {
    where.type = filters.type
  }

  if (filters?.format && VALID_FORMATS.includes(filters.format)) {
    where.format = filters.format
  }

  if (filters?.dateFrom) {
    const date = new Date(filters.dateFrom)
    if (!isNaN(date.getTime())) {
      where.startsAt = { gte: date }
    }
  }

  return where
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
        status: data.status ?? 'DRAFT',
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
   * Finds published groups with optional filters and pagination, ordered by start date.
   * @param filters - Optional search, type, format, and date filters
   * @param pagination - Optional skip/take parameters
   * @returns Array of published groups with organizer, co-organizers, and tags
   */
  async findPublished(filters?: Filters, pagination?: { skip?: number, take?: number }) {
    const where = buildPublishedWhere(filters)
    const { take = 100, skip = 0 } = pagination ?? {}

    return prisma.group.findMany({
      where,
      include: listInclude,
      orderBy: {
        startsAt: 'asc',
      },
      skip,
      take,
    })
  },

  /**
   * Counts published groups matching the given filters.
   * @param filters - Optional search, type, format, and date filters
   * @returns Total count of matching published groups
   */
  async countPublished(filters?: Filters) {
    const where = buildPublishedWhere(filters)
    return prisma.group.count({ where })
  },

  /**
   * Finds the most recently created published groups.
   * @param limit - Maximum number of groups to return
   * @returns Array of latest published groups ordered by creation date
   */
  async findLatest(limit: number) {
    return prisma.group.findMany({
      where: {
        status: 'PUBLISHED',
        ...activeOrganizerFilter,
        startsAt: { gte: new Date() },
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
   * Non-privileged viewers only see PUBLISHED groups (returns null otherwise).
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
          },
        },
        coOrganizers: coOrganizersInclude,
        tags: true,
      },
    })

    if (!group) return null

    const isAdmin = viewer?.role === 'ADMIN'
    const isOwner = viewer?.userId ? group.organizer.userId === viewer.userId : false
    const isCoOrganizer = viewer?.userId
      ? group.coOrganizers.some(co => co.userId === viewer.userId)
      : false

    if (!isAdmin && !isOwner && !isCoOrganizer && group.status !== 'PUBLISHED') {
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
   * Finds a group by ID with organizer's preferred locale for notification purposes.
   * @param id - The group ID
   * @returns The group with organizer user locale, or null if not found
   */
  async findWithOrganizerLocale(id: string) {
    return prisma.group.findUnique({
      where: { id },
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
    const { where = {}, skip = 0, take = 50 } = options

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

  /**
   * Finds an organizer profile by user ID, optionally within a transaction.
   * @param userId - The user ID
   * @param tx - Optional Prisma client or transaction context
   * @returns The organizer profile or null if not found
   */
  async findProfileByUserId(userId: string, tx: PrismaClientOrTx = prisma) {
    return (tx as PrismaClientOrTx).organizerProfile.findUnique({
      where: { userId },
    })
  },
}

export { coOrganizersInclude, listInclude, activeOrganizerFilter, buildPublishedWhere }
