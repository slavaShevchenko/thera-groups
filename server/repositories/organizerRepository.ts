import type { Prisma } from '@prisma/client'
import { prisma } from '../utils/prisma'

export const organizerRepository = {
  async findByUserId(userId: string) {
    return prisma.organizerProfile.findUnique({
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
}
