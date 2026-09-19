import type { Prisma } from '@prisma/client'
import { prisma } from '../utils/prisma'
import type { PrismaClientOrTx } from './types'

export const organizerRepository = {
  /**
   * Finds an organizer profile by user ID, optionally within a transaction.
   * @param userId - The user ID
   * @param tx - Optional Prisma client or transaction context
   * @returns The organizer profile or null if not found
   */
  async findByUserId(userId: string, tx: PrismaClientOrTx = prisma) {
    return (tx as PrismaClientOrTx).organizerProfile.findUnique({
      where: { userId },
    })
  },

  /**
   * Finds an organizer profile by slug with user email and locale.
   * @param slug - The organizer's URL-friendly slug
   * @returns The organizer profile with user info, or null if not found
   */
  async findBySlug(slug: string) {
    return prisma.organizerProfile.findUnique({
      where: { slug },
      include: { user: { select: { email: true, preferredLocale: true } } },
    })
  },

  /**
   * Finds all organizer profiles with user status and group count for admin panel.
   * @param options - Optional skip/take pagination parameters
   * @returns Object with organizers array and total count
   */
  async findAllWithDetails(options: {
    skip?: number
    take?: number
  } = {}) {
    const { skip = 0, take = 50 } = options

    const [organizers, total] = await Promise.all([
      prisma.organizerProfile.findMany({
        include: {
          user: { select: { email: true, isActive: true } },
          _count: { select: { groups: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      prisma.organizerProfile.count(),
    ])

    return { organizers, total }
  },

  /**
   * Finds all organizer profiles awaiting verification, ordered by creation date.
   * @returns Array of pending organizer profiles with user email
   */
  async findPendingVerification() {
    return prisma.organizerProfile.findMany({
      where: { verificationStatus: 'PENDING' },
      include: { user: { select: { email: true } } },
      orderBy: { createdAt: 'asc' },
    })
  },

  /**
   * Updates an organizer profile's data by ID.
   * @param id - The organizer profile ID
   * @param data - Prisma update input for the organizer profile
   * @returns The updated organizer profile
   */
  async update(id: string, data: Prisma.OrganizerProfileUpdateInput) {
    return prisma.organizerProfile.update({ where: { id }, data })
  },

  /**
   * Checks whether an organizer profile with the given slug already exists.
   * @param slug - The slug to check
   * @returns True if a profile with the slug exists, false otherwise
   */
  async slugExists(slug: string): Promise<boolean> {
    const profile = await prisma.organizerProfile.findUnique({ where: { slug } })
    return !!profile
  },

  /**
   * Finds an organizer profile by ID with user ID and preferred locale.
   * @param id - The organizer profile ID
   * @returns The organizer profile with user info, or null if not found
   */
  async findByIdWithUser(id: string) {
    return prisma.organizerProfile.findUnique({
      where: { id },
      include: { user: { select: { id: true, preferredLocale: true } } },
    })
  },

  /**
   * Finds an organizer profile by ID without relations.
   * @param id - The organizer profile ID
   * @returns The organizer profile or null if not found
   */
  async findById(id: string) {
    return prisma.organizerProfile.findUnique({
      where: { id },
    })
  },

  /**
   * Finds an organizer profile by ID selecting only userId, optionally within a transaction.
   * @param id - The organizer profile ID
   * @param tx - Optional Prisma client or transaction context
   * @returns The profile with userId or null if not found
   */
  async findProfileById(id: string, tx: PrismaClientOrTx = prisma) {
    return (tx as PrismaClientOrTx).organizerProfile.findUnique({
      where: { id },
      select: { userId: true },
    })
  },

  /**
   * Finds an organizer profile by ID with the full user record.
   * @param id - The organizer profile ID
   * @returns The organizer profile with complete user data, or null if not found
   */
  async findByIdWithFullUser(id: string) {
    return prisma.organizerProfile.findUnique({
      where: { id },
      include: { user: true },
    })
  },

  /**
   * Finds an organizer profile by user ID without relations.
   * @param userId - The user ID
   * @returns The organizer profile or null if not found
   */
  async findProfileByUserId(userId: string) {
    return prisma.organizerProfile.findUnique({
      where: { userId },
    })
  },

  /**
   * Finds verified organizers with optional city and format filters, including published group counts.
   * @param filters - Optional city (case-insensitive contains) and format (work format array match) filters
   * @returns Array of verified organizer profiles with published group counts
   */
  async findVerifiedOrganizers(filters: {
    city?: string
    format?: string
  } = {}) {
    const where: Record<string, unknown> = {
      verificationStatus: 'VERIFIED',
      user: { isActive: true },
    }

    if (filters.city) {
      where.city = { contains: filters.city, mode: 'insensitive' }
    }

    if (filters.format) {
      where.workFormats = { has: filters.format }
    }

    return prisma.organizerProfile.findMany({
      where,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        slug: true,
        avatarUrl: true,
        city: true,
        experienceYears: true,
        specializations: true,
        _count: {
          select: {
            groups: {
              where: { status: 'PUBLISHED' },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })
  },

  /**
   * Finds an organizer by slug with their published groups and organizer details.
   * @param slug - The organizer's URL-friendly slug
   * @returns The organizer profile with groups or null if not found
   */
  async findBySlugWithGroups(slug: string) {
    return prisma.organizerProfile.findUnique({
      where: { slug },
      include: {
        groups: {
          include: {
            organizer: {
              select: {
                firstName: true,
                lastName: true,
                avatarUrl: true,
              },
            },
          },
          orderBy: { startsAt: 'asc' },
        },
      },
    })
  },
}
