import type { Prisma, Role } from '@prisma/client'
import { prisma } from '../utils/prisma'

export const userRepository = {
  /**
   * Finds a user by ID with their organizer profile.
   * @param id - The user ID
   * @returns The user with organizer profile or null if not found
   */
  async findById(id: string) {
    return prisma.user.findUnique({
      where: { id },
      include: { organizerProfile: true },
    })
  },

  /**
   * Finds a user by their Supabase auth ID with organizer profile.
   * @param authId - The Supabase auth user ID
   * @returns The user with organizer profile or null if not found
   */
  async findByAuthId(authId: string) {
    return prisma.user.findUnique({
      where: { authId },
      include: { organizerProfile: true },
    })
  },

  /**
   * Finds a user by email address without relations.
   * @param email - The user's email
   * @returns The user or null if not found
   */
  async findByEmail(email: string) {
    return prisma.user.findUnique({ where: { email } })
  },

  /**
   * Finds all users with optional role filter and pagination for admin panel.
   * @param options - Optional role filter and skip/take pagination
   * @returns Object with users array and total count
   */
  async findAll(options: {
    role?: Role
    skip?: number
    take?: number
  } = {}) {
    const { role, skip = 0, take = 50 } = options
    const where: Prisma.UserWhereInput = role ? { role } : {}

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        take,
        skip,
        orderBy: { createdAt: 'desc' },
        include: { organizerProfile: true },
      }),
      prisma.user.count({ where }),
    ])

    return { users, total }
  },

  /**
   * Updates a user's data by ID.
   * @param id - The user ID
   * @param data - Prisma update input for the user
   * @returns The updated user record
   */
  async update(id: string, data: Prisma.UserUpdateInput) {
    return prisma.user.update({ where: { id }, data })
  },

  /**
   * Deletes a user by ID.
   * @param id - The user ID
   * @returns The deleted user record
   */
  async delete(id: string) {
    return prisma.user.delete({ where: { id } })
  },

  /**
   * Finds active organizer users by IDs, used to validate co-organizer assignments.
   * @param ids - Array of user IDs to validate
   * @returns Array of matching user IDs that are active organizers
   */
  async findValidOrganizerUsers(ids: string[]) {
    return prisma.user.findMany({
      where: {
        id: { in: ids },
        role: 'ORGANIZER',
        isActive: true,
      },
      select: { id: true },
    })
  },
}
