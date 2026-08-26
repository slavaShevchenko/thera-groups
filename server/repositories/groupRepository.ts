import { prisma } from '../utils/prisma'

const listInclude = {
  organizer: {
    select: {
      firstName: true,
      lastName: true,
      avatarUrl: true,
    },
  },
  category: true,
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
        category: true,
        tags: true,
      },
    })
  },
}
