import type { Prisma, NotificationType } from '@prisma/client'
import { prisma } from '../utils/prisma'

export const notificationRepository = {
  async findByUser(userId: string, options: {
    unreadOnly?: boolean
    take?: number
  } = {}) {
    const { unreadOnly = false, take = 50 } = options
    const where: Prisma.NotificationWhereInput = {
      userId,
      ...(unreadOnly && { readAt: null }),
    }

    return prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take,
    })
  },

  async countUnread(userId: string): Promise<number> {
    return prisma.notification.count({
      where: { userId, readAt: null },
    })
  },

  async create(data: {
    userId: string
    type: NotificationType
    entityType: string
    entityId: string
    title: string
    message: string
  }) {
    return prisma.notification.create({ data })
  },

  async markAsRead(id: string, userId: string) {
    return prisma.notification.update({
      where: { id, userId },
      data: { readAt: new Date() },
    })
  },

  async markAllAsRead(userId: string) {
    return prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    })
  },
}
