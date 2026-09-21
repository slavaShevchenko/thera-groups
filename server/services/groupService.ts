import type { Prisma } from '@prisma/client'
import { groupRepository } from '../repositories/groupRepository'
import { organizerRepository } from '../repositories/organizerRepository'
import { userRepository } from '../repositories/userRepository'
import { notifyAdminsGroupPendingReview, notifyGroupPublished, notifyGroupRejected } from '../utils/notifications'
import { prisma } from '../utils/prisma'
import { NotFoundError, ForbiddenError, ValidationError } from '../utils/domainErrors'
import type { UpdateGroupInput } from '../validators/group'
import type { Filters } from '~~/types'

const CRITICAL_FIELDS = [
  'title', 'description', 'type', 'format', 'location',
  'priceAmount', 'currency', 'startsAt', 'endsAt', 'capacity',
] as const

const VALID_STATUS_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ['PENDING_REVIEW'],
  PENDING_REVIEW: ['PUBLISHED', 'REJECTED'],
  REJECTED: ['PENDING_REVIEW'],
  PUBLISHED: ['PENDING_REVIEW', 'FULL', 'CANCELLED'],
  FULL: ['PUBLISHED', 'COMPLETED'],
  CANCELLED: [],
  COMPLETED: [],
}

function validateStatusTransition(currentStatus: string, newStatus: string, role: string): void {
  const allowed = VALID_STATUS_TRANSITIONS[currentStatus] ?? []
  if (!allowed.includes(newStatus)) {
    throw new ValidationError(
      `Cannot transition from ${currentStatus} to ${newStatus}`,
    )
  }
  if (newStatus === 'PUBLISHED' && role !== 'ADMIN') {
    throw new ForbiddenError('Only admins can publish groups. Use PENDING_REVIEW instead.')
  }
  if (newStatus === 'PENDING_REVIEW' && role !== 'ADMIN') {
    if (currentStatus !== 'DRAFT' && currentStatus !== 'PENDING_REVIEW' && currentStatus !== 'REJECTED' && currentStatus !== 'PUBLISHED') {
      throw new ValidationError('Can only submit DRAFT, REJECTED or PUBLISHED groups for review')
    }
  }
}

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
      throw new NotFoundError('Group not found')
    }
    return group
  },

  async create(data: {
    organizerId: string
    title?: string
    slug: string
    description?: string
  }) {
    const profile = await organizerRepository.findById(data.organizerId)
    if (!profile) {
      throw new NotFoundError('Organizer profile not found')
    }

    const group = await groupRepository.create({
      organizerId: data.organizerId,
      title: data.title ?? '',
      slug: data.slug,
      description: data.description ?? '',
      status: 'DRAFT',
    })

    return group
  },

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
    const existing = await groupRepository.findBySlugForUpdate(slug)

    if (!existing) {
      throw new NotFoundError('Group not found')
    }

    const isOwner = existing.organizer.userId === ctx.userId
    const isCoOrganizer = existing.coOrganizers.some(c => c.userId === ctx.userId)

    if (!isOwner && !ctx.isAdmin && !isCoOrganizer) {
      throw new ForbiddenError()
    }

    const data: UpdateGroupInput = { ...input }

    if (isCoOrganizer && !isOwner && !ctx.isAdmin) {
      delete data.coOrganizers
      delete data.status
    }

    if (data.tagIds) {
      const tags = await groupRepository.findTagsByIds(data.tagIds)
      if (tags.length !== data.tagIds.length) {
        throw new ValidationError('Some tags not found')
      }
    }

    const updateData: Prisma.GroupUpdateInput = {}

    if (data.title !== undefined) updateData.title = data.title
    if (data.description !== undefined) updateData.description = data.description
    if (data.type !== undefined) updateData.type = data.type
    if (data.format !== undefined) updateData.format = data.format
    if (data.location !== undefined) updateData.location = data.location
    if (data.priceAmount !== undefined) updateData.priceAmount = data.priceAmount ?? null
    if (data.currency !== undefined) updateData.currency = data.currency || 'UAH'
    if (data.maxParticipants !== undefined) updateData.capacity = data.maxParticipants ?? null
    if (data.startDate) updateData.startsAt = new Date(data.startDate)
    if (data.endDate) updateData.endsAt = new Date(data.endDate)

    let newStatus = data.status

    if (ctx.organizerId && ctx.isAdmin) {
      const newOrganizerProfile = await organizerRepository.findByUserId(ctx.organizerId)
      if (!newOrganizerProfile) {
        throw new ValidationError('Selected organizer profile not found')
      }
      updateData.organizerId = newOrganizerProfile.id
    }

    const criticalChanged = Object.keys(data).some(key =>
      (CRITICAL_FIELDS as readonly string[]).includes(key),
    )

    if (existing.status === 'PUBLISHED' && criticalChanged && !newStatus) {
      newStatus = 'PENDING_REVIEW'
    }

    if (newStatus) {
      validateStatusTransition(existing.status, newStatus, ctx.role)
      updateData.status = newStatus
      if (newStatus === 'PENDING_REVIEW') {
        updateData.rejectionReason = null
      }
    }

    const shouldNotifyAdmins = newStatus === 'PENDING_REVIEW' && existing.status !== 'PENDING_REVIEW'

    const result = await prisma.$transaction(async (tx) => {
      const updated = await groupRepository.update(
        existing.id,
        {
          ...updateData,
          ...(data.tagIds !== undefined && {
            tags: {
              set: data.tagIds.map(id => ({ id })),
            },
          }),
        },
        tx,
      )

      if (shouldNotifyAdmins) {
        await notifyAdminsGroupPendingReview(updated.title, updated.slug, tx)
      }

      if (data.questions !== undefined) {
        const applicationsCount = await tx.application.count({ where: { groupId: existing.id } })
        if (applicationsCount > 0) {
          throw new ValidationError('Cannot modify questions after applications have been submitted')
        }

        for (const q of data.questions) {
          if (!q) continue
          if ((q.type === 'SINGLE_CHOICE' || q.type === 'MULTIPLE_CHOICE') && q.options.length < 2) {
            throw new ValidationError(`Question "${q.question}" requires at least 2 options`)
          }
        }

        await groupRepository.deleteQuestionsByGroup(existing.id, tx)

        const validQuestions = data.questions
          .filter((q): q is NonNullable<typeof q> => q != null)
          .map((q, index) => ({
            question: q.question,
            type: q.type,
            required: q.required,
            options: q.options,
            position: index,
          }))

        if (validQuestions.length > 0) {
          await groupRepository.createQuestionsMany(existing.id, validQuestions, tx)
        }
      }

      if (data.coOrganizers !== undefined) {
        const effectiveOrganizerUserId = (updateData.organizerId as string)
          ? (await organizerRepository.findProfileById(updateData.organizerId as string, tx))?.userId ?? existing.organizer.userId
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
          const validUsers = await userRepository.findValidOrganizerUsers(userIds)

          if (validUsers.length !== userIds.length) {
            throw new ValidationError('Some co-organizer users are not valid active organizers')
          }
        }

        await groupRepository.deleteCoOrganizersByGroup(existing.id, tx)

        if (uniqueCoOrganizers.length > 0) {
          await groupRepository.createCoOrganizersMany(
            existing.id,
            uniqueCoOrganizers.map((c, index) => ({
              userId: c.userId,
              role: c.role,
              sortOrder: index,
            })),
            tx,
          )
        }
      }

      return updated
    })

    return {
      success: true,
      group: {
        id: result.id,
        slug: result.slug,
        title: result.title,
        status: result.status,
      },
    }
  },

  async moderateGroup(
    id: string,
    status: 'PUBLISHED' | 'REJECTED',
    rejectionReason?: string,
  ) {
    const group = await groupRepository.findByIdForModeration(id)

    if (!group) {
      throw new NotFoundError('Group not found')
    }

    if (status === 'PUBLISHED' && group.status !== 'PENDING_REVIEW') {
      throw new ValidationError('Can only approve groups with PENDING_REVIEW status')
    }

    if (status === 'REJECTED') {
      if (group.status !== 'PENDING_REVIEW' && group.status !== 'PUBLISHED') {
        throw new ValidationError('Can only reject groups with PENDING_REVIEW or PUBLISHED status')
      }
      if (!rejectionReason?.trim()) {
        throw new ValidationError('Rejection reason is required')
      }
    }

    const updated = await groupRepository.updateForModeration(id, {
      status,
      rejectionReason: status === 'REJECTED' ? (rejectionReason ?? null) : null,
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
