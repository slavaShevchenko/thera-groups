import { prisma } from '../utils/prisma'

const groupWithDetailsInclude = {
  include: {
    organizer: {
      select: {
        firstName: true,
        lastName: true,
        avatarUrl: true,
      },
    },
    coOrganizers: {
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
    },
    _count: {
      select: { applications: true },
    },
  },
}

export const favoriteRepository = {
  async findByUser(userId: string) {
    return prisma.favorite.findMany({
      where: {
        userId,
        group: { status: 'PUBLISHED' },
      },
      include: {
        group: groupWithDetailsInclude,
      },
      orderBy: { createdAt: 'desc' },
    })
  },

  async create(userId: string, groupId: string) {
    return prisma.favorite.create({
      data: { userId, groupId },
    })
  },

  async remove(userId: string, groupId: string) {
    return prisma.favorite.delete({
      where: { userId_groupId: { userId, groupId } },
    })
  },

  async findByUserAndGroup(userId: string, groupId: string) {
    return prisma.favorite.findUnique({
      where: { userId_groupId: { userId, groupId } },
    })
  },
}
