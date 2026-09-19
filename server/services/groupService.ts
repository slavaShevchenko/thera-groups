import type { Filters } from '~~/types'
import type { UpdateGroupInput } from '../validators/group'
import { groupRepository } from '../repositories/groupRepository'
import { notifyAdminsGroupPendingReview, notifyGroupPublished, notifyGroupRejected } from '../utils/notifications'

export const groupService = {
  async getPublishedGroups(filters?: Filters, pagination?: { skip?: number, take?: number }) {
    const [groups, total] = await Promise.all([
      groupRepository.findPublished(filters, pagination),
      groupRepository.countPublished(filters),
    ])
    return { groups, total }
  },

  async getLatestGroups(limit = 6) {
    return groupRepository.findLatest(limit)
  },

  async getGroupBySlug(slug: string) {
    const group = await groupRepository.findBySlug(slug)

    if (!group) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Group not found',
      })
    }

    return group
  },

  /**
   * Update group with questions, tags and co-organizers.
   * Handles authorization, status transition rules and field mapping.
   */
  async updateGroup(
    slug: string,
    input: UpdateGroupInput,
    ctx: {
      userId: string
      role: string
      isAdmin: boolean
      organizerId?: string
    },
  ) {
    const existing = await prisma.group.findUnique({
      where: { slug },
      include: {
        organizer: true,
        coOrganizers: { select: { userId: true } },
      },
    })

    if (!existing) {
      throw createError({ statusCode: 404, statusMessage: 'Group not found' })
    }

    const isOwner = existing.organizer.userId === ctx.userId
    const isCoOrganizer = existing.coOrganizers.some(c => c.userId === ctx.userId)

    if (!isOwner && !ctx.isAdmin && !isCoOrganizer) {
      throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
    }

    // Work on a mutable copy so role-based restrictions don't affect caller's object
    const data: UpdateGroupInput = { ...input }

    // Co-organizers can edit common fields but not status or co-organizers.
    // UI hides these controls, but autosave sends the full payload — silently ignore restricted fields.
    if (isCoOrganizer && !isOwner && !ctx.isAdmin) {
      delete data.coOrganizers
      delete data.status
    }

    // Validate tags exist
    if (data.tagIds) {
      const tags = await prisma.groupTag.findMany({ where: { id: { in: data.tagIds } } })
      if (tags.length !== data.tagIds.length) {
        throw createError({ statusCode: 400, statusMessage: 'Some tags not found' })
      }
    }

    // Status transition rules
    if (data.status) {
      if (data.status === 'PUBLISHED' && !ctx.isAdmin) {
        throw createError({
          statusCode: 403,
          statusMessage: 'Only admins can publish groups. Use PENDING_REVIEW instead.',
        })
      }

      if (data.status === 'PENDING_REVIEW' && !ctx.isAdmin) {
        if (existing.status !== 'DRAFT' && existing.status !== 'PENDING_REVIEW' && existing.status !== 'REJECTED') {
          throw createError({
            statusCode: 400,
            statusMessage: 'Can only submit DRAFT or REJECTED groups for review',
          })
        }
      }

      if (existing.status === 'PUBLISHED' && !ctx.isAdmin) {
        if (data.status !== existing.status) {
          throw createError({
            statusCode: 403,
            statusMessage: 'Cannot change status of published group. Contact admin.',
          })
        }
      }
    }

    // Build update payload — map API fields to DB columns
    const updateData: Record<string, unknown> = {}

    if (data.title !== undefined) updateData.title = data.title
    if (data.description !== undefined) updateData.description = data.description
    if (data.type !== undefined) updateData.type = data.type
    if (data.format !== undefined) updateData.format = data.format
    if (data.location !== undefined) updateData.location = data.location
    if (data.price !== undefined) updateData.price = data.price ?? null
    if (data.priceAmount !== undefined) updateData.priceAmount = data.priceAmount ?? null
    if (data.currency !== undefined) updateData.currency = data.currency || 'UAH'

    if (data.status !== undefined) {
      updateData.status = data.status
      if (data.status === 'PENDING_REVIEW') {
        updateData.rejectionReason = null
      }
    }

    if (data.maxParticipants !== undefined) updateData.capacity = data.maxParticipants ?? 10
    if (data.startDate) updateData.startsAt = new Date(data.startDate)
    if (data.endDate) updateData.endsAt = new Date(data.endDate)

    // Admin: reassign organizer
    if (ctx.organizerId && ctx.isAdmin) {
      const newOrganizerProfile = await prisma.organizerProfile.findUnique({
        where: { userId: ctx.organizerId },
      })
      if (!newOrganizerProfile) {
        throw createError({ statusCode: 400, statusMessage: 'Selected organizer profile not found' })
      }
      updateData.organizerId = newOrganizerProfile.id
    }

    const updated = await prisma.group.update({
      where: { id: existing.id },
      data: {
        ...updateData,
        ...(data.tagIds !== undefined && {
          tags: {
            set: data.tagIds.map(id => ({ id })),
          },
        }),
      },
    })

    // Notify admins on submission for review
    if (data.status === 'PENDING_REVIEW' && existing.status !== 'PENDING_REVIEW') {
      await notifyAdminsGroupPendingReview(updated.title, updated.slug)
    }

    // Update questions (delete + recreate)
    if (data.questions !== undefined) {
      await prisma.applicationQuestion.deleteMany({
        where: { groupId: existing.id },
      })

      for (let i = 0; i < data.questions.length; i++) {
        const q = data.questions[i]
        if (!q) continue

        if ((q.type === 'SINGLE_CHOICE' || q.type === 'MULTIPLE_CHOICE') && q.options.length < 2) {
          throw createError({
            statusCode: 400,
            statusMessage: `Question "${q.question}" requires at least 2 options`,
          })
        }

        await prisma.applicationQuestion.create({
          data: {
            groupId: existing.id,
            question: q.question,
            type: q.type,
            required: q.required,
            options: q.options,
            position: i,
          },
        })
      }
    }

    // Update co-organizers (delete + recreate)
    if (data.coOrganizers !== undefined) {
      const effectiveOrganizerUserId = (updateData.organizerId as string)
        ? (await prisma.organizerProfile.findUnique({
            where: { id: updateData.organizerId as string },
            select: { userId: true },
          }))?.userId ?? existing.organizer.userId
        : existing.organizer.userId

      const filteredCoOrganizers = data.coOrganizers.filter(c => c.userId !== effectiveOrganizerUserId)

      const userIds = filteredCoOrganizers.map(c => c.userId)

      const seen = new Set<string>()
      const uniqueCoOrganizers = filteredCoOrganizers.filter((c) => {
        if (seen.has(c.userId)) return false
        seen.add(c.userId)
        return true
      })

      if (userIds.length > 0) {
        const validUsers = await prisma.user.findMany({
          where: {
            id: { in: userIds },
            role: 'ORGANIZER',
            isActive: true,
          },
          select: { id: true },
        })

        if (validUsers.length !== userIds.length) {
          throw createError({
            statusCode: 400,
            statusMessage: 'Some co-organizer users are not valid active organizers',
          })
        }
      }

      await prisma.groupCoOrganizer.deleteMany({
        where: { groupId: existing.id },
      })

      if (uniqueCoOrganizers.length > 0) {
        await prisma.groupCoOrganizer.createMany({
          data: uniqueCoOrganizers.map((c, index) => ({
            groupId: existing.id,
            userId: c.userId,
            role: c.role,
            sortOrder: index,
          })),
        })
      }
    }

    return {
      success: true,
      group: {
        id: updated.id,
        slug: updated.slug,
        title: updated.title,
        status: updated.status,
      },
    }
  },

  /**
   * Admin moderation: approve or reject a group.
   */
  async moderateGroup(
    id: string,
    status: 'PUBLISHED' | 'REJECTED',
    rejectionReason?: string,
  ) {
    const group = await prisma.group.findUnique({
      where: { id },
      select: { id: true, status: true, title: true, slug: true },
    })

    if (!group) {
      throw createError({ statusCode: 404, statusMessage: 'Group not found' })
    }

    if (status === 'PUBLISHED' && group.status !== 'PENDING_REVIEW') {
      throw createError({
        statusCode: 400,
        statusMessage: 'Can only approve groups with PENDING_REVIEW status',
      })
    }

    if (status === 'REJECTED') {
      if (group.status !== 'PENDING_REVIEW' && group.status !== 'PUBLISHED') {
        throw createError({
          statusCode: 400,
          statusMessage: 'Can only reject groups with PENDING_REVIEW or PUBLISHED status',
        })
      }
      if (!rejectionReason?.trim()) {
        throw createError({
          statusCode: 400,
          statusMessage: 'Rejection reason is required',
        })
      }
    }

    const updated = await prisma.group.update({
      where: { id },
      data: {
        status,
        rejectionReason: status === 'REJECTED' ? rejectionReason : null,
      },
      include: {
        organizer: {
          select: {
            userId: true,
            user: { select: { preferredLocale: true } },
          },
        },
      },
    })

    if (status === 'PUBLISHED') {
      await notifyGroupPublished(
        updated.organizer.userId,
        updated.title,
        updated.slug,
        updated.organizer.user.preferredLocale,
      )
    }
    else if (status === 'REJECTED' && rejectionReason) {
      await notifyGroupRejected(
        updated.organizer.userId,
        updated.title,
        updated.slug,
        rejectionReason,
        updated.organizer.user.preferredLocale,
      )
    }

    return {
      group: {
        id: updated.id,
        slug: updated.slug,
        title: updated.title,
        status: updated.status,
        rejectionReason: updated.rejectionReason,
      },
    }
  },
}
