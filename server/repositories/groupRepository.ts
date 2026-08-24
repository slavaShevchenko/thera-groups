import { prisma } from '../utils/prisma'

const listInclude = {
  therapist: {
    select: {
      firstName: true,
      lastName: true,
      avatar: true,
    },
  },
  category: true,
  tags: true,
}

const activeTherapistFilter = {
  therapist: {
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
        ...activeTherapistFilter,
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
        ...activeTherapistFilter,
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
        ...activeTherapistFilter,
      },
      include: {
        therapist: {
          select: {
            firstName: true,
            lastName: true,
            avatar: true,
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
