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

  async countPublished(filters?: Filters) {
    const where = buildPublishedWhere(filters)
    return prisma.group.count({ where })
  },

  async findLatest(limit: number) {
    return prisma.group.findMany({
      where: {
        status: 'PUBLISHED',
        ...activeOrganizerFilter,
      },
      include: listInclude,
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
    })
  },

  async findBySlug(slug: string) {
    return prisma.group.findFirst({
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
  },

  async findBySlugForUpdate(slug: string) {
    return prisma.group.findFirst({
      where: { slug },
      include: {
        organizer: { select: { id: true, userId: true } },
        coOrganizers: { select: { userId: true } },
      },
    })
  },

  async findTagsByIds(ids: string[], tx: PrismaClientOrTx = prisma) {
    return (tx as PrismaClientOrTx).groupTag.findMany({
      where: { id: { in: ids } },
    })
  },

  async update(id: string, data: Prisma.GroupUpdateInput, tx: PrismaClientOrTx = prisma) {
    return (tx as PrismaClientOrTx).group.update({ where: { id }, data })
  },

  async findByIdForModeration(id: string) {
    return prisma.group.findUnique({
      where: { id },
      select: { id: true, status: true, title: true, slug: true },
    })
  },

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

  async deleteQuestionsByGroup(groupId: string, tx: PrismaClientOrTx = prisma) {
    return (tx as PrismaClientOrTx).applicationQuestion.deleteMany({
      where: { groupId },
    })
  },

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

  async deleteCoOrganizersByGroup(groupId: string, tx: PrismaClientOrTx = prisma) {
    return (tx as PrismaClientOrTx).groupCoOrganizer.deleteMany({
      where: { groupId },
    })
  },

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

  async findProfileByUserId(userId: string, tx: PrismaClientOrTx = prisma) {
    return (tx as PrismaClientOrTx).organizerProfile.findUnique({
      where: { userId },
    })
  },
}

export { coOrganizersInclude, listInclude, activeOrganizerFilter, buildPublishedWhere }
