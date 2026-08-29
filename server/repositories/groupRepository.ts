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

export const groupRepository = {
  async findPublished() {
    return prisma.group.findMany({
      where: {
        status: 'PUBLISHED',
        ...activeOrganizerFilter,
      },
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
