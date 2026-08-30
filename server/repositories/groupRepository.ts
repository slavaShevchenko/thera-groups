import { prisma } from '../utils/prisma'

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

export interface GroupFilters {
  q?: string
  type?: string
  format?: string
  dateFrom?: string
}

const VALID_TYPES = [
  'THERAPEUTIC', 'WORKSHOP', 'SEMINAR', 'LECTURE', 'LECTURE_COURSE',
  'INTENSIVE', 'AUTHOR_PROGRAM', 'SUPERVISION', 'CONFERENCE', 'CERTIFICATION',
  'SPECIALIZATION', 'FOUNDATION', 'ADVANCED', 'PROFESSIONAL', 'MODULAR',
  'PARTNERSHIP', 'INTERNATIONAL', 'PILOT', 'OTHER',
]

const VALID_FORMATS = ['ONLINE', 'OFFLINE', 'HYBRID']

export const groupRepository = {
  async findPublished(filters?: GroupFilters) {
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

    return prisma.group.findMany({
      where,
      include: listInclude,
      orderBy: {
        startsAt: 'asc',
      },
    })
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
    return prisma.group.findUnique({
      where: {
        slug,
        ...activeOrganizerFilter,
      },
      include: {
        organizer: {
          select: {
            firstName: true,
            lastName: true,
            slug: true,
            avatarUrl: true,
            bio: true,
            qualification: true,
            specialization: true,
            experienceYears: true,
          },
        },
        coOrganizers: coOrganizersInclude,
        tags: true,
      },
    })
  },
}
