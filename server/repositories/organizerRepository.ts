import type { Prisma } from '@prisma/client'
import { prisma } from '../utils/prisma'
import type { PrismaClientOrTx } from './types'

export const organizerRepository = {
  async findByUserId(userId: string, tx: PrismaClientOrTx = prisma) {
    return (tx as PrismaClientOrTx).organizerProfile.findUnique({
      where: { userId },
    })
  },

  async findBySlug(slug: string) {
    return prisma.organizerProfile.findUnique({
      where: { slug },
      include: { user: { select: { email: true, preferredLocale: true } } },
    })
  },

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

  async findPendingVerification() {
    return prisma.organizerProfile.findMany({
      where: { verificationStatus: 'PENDING' },
      include: { user: { select: { email: true } } },
      orderBy: { createdAt: 'asc' },
    })
  },

  async update(id: string, data: Prisma.OrganizerProfileUpdateInput) {
    return prisma.organizerProfile.update({ where: { id }, data })
  },

  async slugExists(slug: string): Promise<boolean> {
    const profile = await prisma.organizerProfile.findUnique({ where: { slug } })
    return !!profile
  },

  async findByIdWithUser(id: string) {
    return prisma.organizerProfile.findUnique({
      where: { id },
      include: { user: { select: { id: true, preferredLocale: true } } },
    })
  },

  async findById(id: string) {
    return prisma.organizerProfile.findUnique({
      where: { id },
    })
  },

  async findProfileById(id: string, tx: PrismaClientOrTx = prisma) {
    return (tx as PrismaClientOrTx).organizerProfile.findUnique({
      where: { id },
      select: { userId: true },
    })
  },

  async findByIdWithFullUser(id: string) {
    return prisma.organizerProfile.findUnique({
      where: { id },
      include: { user: true },
    })
  },

  async findProfileByUserId(userId: string) {
    return prisma.organizerProfile.findUnique({
      where: { userId },
    })
  },

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
