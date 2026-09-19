import type { Prisma, NotificationType } from '@prisma/client'
import { prisma } from '../utils/prisma'

export const notificationRepository = {
  /**
   * Finds notifications for a user with optional unread-only filter and limit.
   * @param userId - The user ID
   * @param options - Optional unreadOnly flag and take limit
   * @returns Array of notifications ordered by creation date (newest first)
   */
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

  /**
   * Counts unread notifications for a user.
   * @param userId - The user ID
   * @returns Number of unread notifications
   */
  async countUnread(userId: string): Promise<number> {
    return prisma.notification.count({
      where: { userId, readAt: null },
    })
  },

  /**
   * Creates a new notification for a user.
   * @param data - Notification data including userId, type, entity info, title, and message
   * @returns The created notification record
   */
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

  /**
   * Marks a single notification as read, scoped to the owning user.
   * @param id - The notification ID
   * @param userId - The user ID for ownership verification
   * @returns The updated notification with readAt set
   */
  async markAsRead(id: string, userId: string) {
    return prisma.notification.update({
      where: { id, userId },
      data: { readAt: new Date() },
    })
  },

  /**
   * Marks all unread notifications as read for a user.
   * @param userId - The user ID
   * @returns Count of notifications marked as read
   */
  async markAllAsRead(userId: string) {
    return prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    })
  },
}
