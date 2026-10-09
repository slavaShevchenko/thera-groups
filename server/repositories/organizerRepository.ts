import type { Prisma } from '@prisma/client'
import { prisma } from '../utils/prisma'
import { cardSelect } from './groupRepository'
import { PUBLIC_GROUP_STATUSES } from '~~/shared/constants/groupStatus'
import type { PrismaClientOrTx } from './types'

interface OrganizerFilters {
  q?: string
  city?: string
  format?: string
}

function buildOrganizerWhere(filters: OrganizerFilters = {}): Prisma.OrganizerProfileWhereInput {
  const { q, city, format } = filters
  const where: Prisma.OrganizerProfileWhereInput = {
    verificationStatus: 'VERIFIED',
    user: { isActive: true },
  }
  const term = q?.trim()
  if (term) {
    where.OR = [
      { firstName: { contains: term, mode: 'insensitive' } },
      { lastName: { contains: term, mode: 'insensitive' } },
    ]
  }
  if (city) {
    where.city = { contains: city, mode: 'insensitive' }
  }
  if (format) {
    where.workFormats = { has: format }
  }
  return where
}

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
      include: { user: { select: { id: true, email: true, preferredLocale: true } } },
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
   * Finds verified organizers with optional search, city and format filters, including published group counts.
   * @param filters - Optional q (case-insensitive contains on first or last name),
   *                  city (case-insensitive contains) and format (work format array match) filters
   * @returns Array of verified organizer profiles with published group counts
   */
  async findVerifiedOrganizers(filters: OrganizerFilters & {
    skip?: number
    take?: number
  } = {}) {
    const { skip, take } = filters
    const where = buildOrganizerWhere(filters)

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
      ...(skip !== undefined && { skip }),
      ...(take !== undefined && { take }),
    })
  },

  async countVerifiedOrganizers(filters: OrganizerFilters = {}) {
    const where = buildOrganizerWhere(filters)
    return prisma.organizerProfile.count({ where })
  },

  /**
   * Finds an organizer by slug with their publicly visible groups.
   *
   * A `select`, not an `include`, on both the profile and its groups, and a status filter
   * on the groups: this feeds an endpoint anybody may call without a session. The bare
   * `include` it replaced shipped every column of every group in every status — so the
   * `organizerId`, `timezone` and `rejectionReason` of DRAFT and REJECTED groups that are
   * published nowhere were readable by an anonymous visitor, along with the profile's own
   * `userId`, which is the value every ownership check on the server trusts.
   *
   * The handler still whitelists what it returns; this narrows what could leak if it stops.
   * @param slug - The organizer's URL-friendly slug
   * @returns The public profile fields with their visible groups, or null if not found
   */
  async findBySlugWithGroups(slug: string) {
    return prisma.organizerProfile.findUnique({
      where: { slug },
      select: {
        slug: true,
        firstName: true,
        lastName: true,
        avatarUrl: true,
        bio: true,
        qualification: true,
        experienceYears: true,
        languages: true,
        workFormats: true,
        city: true,
        education: true,
        professionalOrganization: true,
        professionalOrganizationStatus: true,
        telegramUrl: true,
        instagramUrl: true,
        linkedinUrl: true,
        whatsappUrl: true,
        facebookUrl: true,
        youtubeUrl: true,
        verificationStatus: true,
        specializations: true,
        groups: {
          where: { status: { in: [...PUBLIC_GROUP_STATUSES] } },
          select: cardSelect,
          orderBy: { startsAt: 'asc' },
        },
      },
    })
  },

  async searchUsers(q: string, excludeIds: string[] = []) {
    return prisma.user.findMany({
      where: {
        role: 'ORGANIZER',
        isActive: true,
        ...(excludeIds.length > 0 && {
          id: { notIn: excludeIds },
        }),
        OR: [
          { organizerProfile: { firstName: { contains: q, mode: 'insensitive' } } },
          { organizerProfile: { lastName: { contains: q, mode: 'insensitive' } } },
          { email: { contains: q, mode: 'insensitive' } },
        ],
      },
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
      take: 10,
    })
  },
}
