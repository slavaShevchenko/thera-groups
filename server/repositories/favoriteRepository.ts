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
  /**
   * Finds all favorites for a user, including only groups with PUBLISHED status.
   * @param userId - The user ID
   * @returns Array of favorites with full group details, ordered by creation date
   */
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

  /**
   * Creates a new favorite (bookmark) for a user and group.
   * @param userId - The user ID
   * @param groupId - The group ID to bookmark
   * @returns The created favorite record
   */
  async create(userId: string, groupId: string) {
    return prisma.favorite.create({
      data: { userId, groupId },
    })
  },

  /**
   * Removes a favorite (bookmark) for a user and group using the composite key.
   * @param userId - The user ID
   * @param groupId - The group ID to unbookmark
   * @returns The deleted favorite record
   */
  async remove(userId: string, groupId: string) {
    return prisma.favorite.delete({
      where: { userId_groupId: { userId, groupId } },
    })
  },

  /**
   * Checks if a specific user-group favorite exists using the composite key.
   * @param userId - The user ID
   * @param groupId - The group ID
   * @returns The favorite record or null if not found
   */
  async findByUserAndGroup(userId: string, groupId: string) {
    return prisma.favorite.findUnique({
      where: { userId_groupId: { userId, groupId } },
    })
  },
}
