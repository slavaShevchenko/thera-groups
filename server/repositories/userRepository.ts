import type { Prisma, Role } from '@prisma/client'
import { prisma } from '../utils/prisma'

export const userRepository = {
  async findById(id: string) {
    return prisma.user.findUnique({
      where: { id },
      include: { organizerProfile: true },
    })
  },

  async findByAuthId(authId: string) {
    return prisma.user.findUnique({
      where: { authId },
      include: { organizerProfile: true },
    })
  },

  async findByEmail(email: string) {
    return prisma.user.findUnique({ where: { email } })
  },

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

  async update(id: string, data: Prisma.UserUpdateInput) {
    return prisma.user.update({ where: { id }, data })
  },

  async delete(id: string) {
    return prisma.user.delete({ where: { id } })
  },
}
