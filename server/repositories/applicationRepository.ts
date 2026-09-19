import type { ApplicationStatus, Prisma } from '@prisma/client'
import { prisma } from '../utils/prisma'

export const applicationRepository = {
  async findByEmail(email: string, options: {
    skip?: number
    take?: number
  } = {}) {
    const { skip = 0, take = 50 } = options
    const where = { email }

    const [applications, total] = await Promise.all([
      prisma.application.findMany({
        where,
        take,
        skip,
        orderBy: { createdAt: 'desc' },
        include: { group: { select: { title: true, slug: true } } },
      }),
      prisma.application.count({ where }),
    ])

    return { applications, total }
  },

  async findByGroup(groupId: string | undefined, options: {
    status?: ApplicationStatus
    skip?: number
    take?: number
  } = {}) {
    const { status, skip, take } = options
    const where: Prisma.ApplicationWhereInput = {
      ...(groupId && { groupId }),
      ...(status && { status }),
    }

    return prisma.application.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take,
      include: {
        group: { select: { id: true, title: true, slug: true } },
        answers: {
          include: {
            question: { select: { question: true, type: true } },
          },
        },
      },
    })
  },

  async findById(id: string) {
    return prisma.application.findUnique({
      where: { id },
      include: { group: true, answers: true },
    })
  },

  async countByGroup(where: Prisma.ApplicationWhereInput) {
    return prisma.application.count({ where })
  },

  async countByStatus(groupId?: string) {
    const where: Prisma.ApplicationWhereInput = groupId ? { groupId } : {}
    return prisma.application.groupBy({
      by: ['status'],
      where,
      _count: true,
    })
  },

  async countRecent(where: Prisma.ApplicationWhereInput, since: Date) {
    return prisma.application.count({
      where: { ...where, createdAt: { gte: since } },
    })
  },

  async updateStatus(id: string, status: ApplicationStatus) {
    return prisma.application.update({
      where: { id },
      data: { status },
    })
  },
}
