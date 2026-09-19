import type { Filters } from '~~/types'
import type { UpdateGroupInput } from '../validators/group'
import { groupRepository } from '../repositories/groupRepository'
import { organizerRepository } from '../repositories/organizerRepository'
import { userRepository } from '../repositories/userRepository'
import { notifyAdminsGroupPendingReview, notifyGroupPublished, notifyGroupRejected } from '../utils/notifications'
import { prisma } from '../utils/prisma'

export const groupService = {
  /**
   * Retrieves paginated published groups with optional filters (search, type, format, date).
   * @param filters - Optional search and filter criteria
   * @param pagination - Optional skip/take pagination parameters
   * @returns An object containing the groups array and total count
   */
  async getPublishedGroups(filters?: Filters, pagination?: { skip?: number, take?: number }) {
    const [groups, total] = await Promise.all([
      groupRepository.findPublished(filters, pagination),
      groupRepository.countPublished(filters),
    ])
    return { groups, total }
  },

  /**
   * Fetches the most recently created published groups for the home page.
   * @param limit - Maximum number of groups to return (default 6)
   * @returns Array of latest published groups
   */
  async getLatestGroups(limit = 6) {
    return groupRepository.findLatest(limit)
  },

  /**
   * Retrieves a single published group by its slug with full organizer and tag details.
   * @param slug - The URL-friendly group identifier
   * @returns The group with organizer, co-organizers, and tags
   * @throws 404 error if the group is not found
   */
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
   * Updates a group's fields, questions, co-organizers, and status within a transaction.
   * Enforces ownership/role checks: co-organizers cannot modify status or co-organizer list.
   * Only admins can set status to PUBLISHED; organizers can submit DRAFT/REJECTED groups for review.
   * @param slug - The URL-friendly group identifier
   * @param input - The update payload (partial group fields, questions, co-organizers, status)
   * @param ctx - The authenticated user context (userId, role, isAdmin, organizerId)
   * @returns Success flag with the updated group's id, slug, title, and status
   * @throws 404 if group not found, 403 if user lacks permission, 400 for validation errors
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
    const existing = await groupRepository.findBySlugForUpdate(slug)

    if (!existing) {
      throw createError({ statusCode: 404, statusMessage: 'Group not found' })
    }

    const isOwner = existing.organizer.userId === ctx.userId
    const isCoOrganizer = existing.coOrganizers.some(c => c.userId === ctx.userId)

    if (!isOwner && !ctx.isAdmin && !isCoOrganizer) {
      throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
    }

    const data: UpdateGroupInput = { ...input }

    if (isCoOrganizer && !isOwner && !ctx.isAdmin) {
      delete data.coOrganizers
      delete data.status
    }

    if (data.tagIds) {
      const tags = await groupRepository.findTagsByIds(data.tagIds)
      if (tags.length !== data.tagIds.length) {
        throw createError({ statusCode: 400, statusMessage: 'Some tags not found' })
      }
    }

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

    const updateData: Record<string, unknown> = {}

    if (data.title !== undefined) updateData.title = data.title
    if (data.description !== undefined) updateData.description = data.description
    if (data.type !== undefined) updateData.type = data.type
    if (data.format !== undefined) updateData.format = data.format
    if (data.location !== undefined) updateData.location = data.location
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

    if (ctx.organizerId && ctx.isAdmin) {
      const newOrganizerProfile = await organizerRepository.findByUserId(ctx.organizerId)
      if (!newOrganizerProfile) {
        throw createError({ statusCode: 400, statusMessage: 'Selected organizer profile not found' })
      }
      updateData.organizerId = newOrganizerProfile.id
    }

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

      if (data.status === 'PENDING_REVIEW' && existing.status !== 'PENDING_REVIEW') {
        await notifyAdminsGroupPendingReview(updated.title, updated.slug)
      }

      if (data.questions !== undefined) {
        for (const q of data.questions) {
          if (!q) continue
          if ((q.type === 'SINGLE_CHOICE' || q.type === 'MULTIPLE_CHOICE') && q.options.length < 2) {
            throw createError({
              statusCode: 400,
              statusMessage: `Question "${q.question}" requires at least 2 options`,
            })
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
            throw createError({
              statusCode: 400,
              statusMessage: 'Some co-organizer users are not valid active organizers',
            })
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

  /**
   * Approves or rejects a group as an admin moderator, enforcing valid state transitions.
   * Sends a localized notification to the organizer on publish or reject.
   * @param id - The internal group ID
   * @param status - Target status: PUBLISHED or REJECTED
   * @param rejectionReason - Required when rejecting; ignored when publishing
   * @returns The updated group with id, slug, title, status, and rejectionReason
   * @throws 404 if group not found, 400 if state transition is invalid or rejection reason is missing
   */
  async moderateGroup(
    id: string,
    status: 'PUBLISHED' | 'REJECTED',
    rejectionReason?: string,
  ) {
    const group = await groupRepository.findByIdForModeration(id)

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
