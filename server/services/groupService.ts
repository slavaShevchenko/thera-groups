import type { Prisma, GroupType } from '@prisma/client'
import { groupRepository } from '../repositories/groupRepository'
import { organizerRepository } from '../repositories/organizerRepository'
import { userRepository } from '../repositories/userRepository'
import { notifyAdminsGroupPendingReview, notifyGroupAutoReverted, notifyGroupPublished, notifyGroupRejected, notifyGroupSubmitted } from '../utils/notifications'
import { prisma } from '../utils/prisma'
import { NotFoundError, ForbiddenError, ValidationError } from '../utils/domainErrors'
import type { UpdateGroupInput } from '../validators/group'
import type { Filters } from '~~/types'

/**
 * Named by `UpdateGroupInput` key, not by database column: the trigger below matches against
 * `Object.keys()` of the parsed patch, where the same three fields arrive as `startDate`,
 * `endDate` and `maxParticipants`. The type is what keeps the two vocabularies from drifting.
 */
const CRITICAL_FIELDS: readonly (keyof UpdateGroupInput)[] = [
  'title', 'description', 'type', 'format', 'location',
  'priceAmount', 'currency', 'startDate', 'endDate', 'maxParticipants',
]

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

type GroupRow = NonNullable<Awaited<ReturnType<typeof groupRepository.findBySlugForUpdate>>>

/**
 * Critical fields whose value actually differs from the stored row, named by their
 * update-payload key.
 *
 * Deliberately narrower than the auto-revert trigger, which fires whenever a critical field
 * is merely *present* in the request: the edit form resends its whole payload on every
 * autosave, so listing submitted keys would name fields nobody touched. The trigger itself
 * is left alone — tightening it would let an edited group stay published — but the message
 * has to say what really changed. Empty when nothing did; the email then omits the list.
 *
 * Values are normalized to strings because the row carries `Date` and `Prisma.Decimal`
 * while the payload carries ISO strings and numbers.
 */
function diffCriticalFields(existing: GroupRow, data: UpdateGroupInput): string[] {
  const text = (value: unknown) => (value === undefined || value === null ? null : String(value))

  const numeric = (value: unknown) => {
    if (value === undefined || value === null) return null
    const parsed = Number(value)
    return Number.isNaN(parsed) ? null : String(parsed)
  }

  const instant = (value: unknown) => {
    if (value === undefined || value === null) return null
    const time = value instanceof Date ? value.getTime() : new Date(String(value)).getTime()
    return Number.isNaN(time) ? null : String(time)
  }

  const changed: string[] = []

  const diff = (field: string, next: string | null, previous: string | null) => {
    if (data[field as keyof UpdateGroupInput] !== undefined && next !== previous) {
      changed.push(field)
    }
  }

  diff('title', text(data.title), text(existing.title))
  diff('description', text(data.description), text(existing.description))
  diff('type', text(data.type), text(existing.type))
  diff('format', text(data.format), text(existing.format))
  diff('location', text(data.location), text(existing.location))
  diff('priceAmount', numeric(data.priceAmount), numeric(existing.priceAmount))
  // The update coerces a missing currency to UAH, so the diff compares the coerced value.
  diff('currency', text(data.currency || 'UAH'), text(existing.currency))
  diff('startDate', instant(data.startDate), instant(existing.startsAt))
  diff('endDate', instant(data.endDate), instant(existing.endsAt))
  diff('maxParticipants', numeric(data.maxParticipants), numeric(existing.capacity))

  return changed
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

    if (!existing || !existing.organizer) {
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
    if (data.program !== undefined) updateData.program = data.program || null
    if (data.type !== undefined) updateData.type = data.type as GroupType
    if (data.format !== undefined) updateData.format = data.format
    if (data.location !== undefined) updateData.location = data.location
    if (data.priceAmount !== undefined) updateData.priceAmount = data.priceAmount ?? null
    if (data.currency !== undefined) updateData.currency = data.currency || 'UAH'
    if (data.maxParticipants !== undefined) updateData.capacity = data.maxParticipants ?? null
    if (data.minParticipants !== undefined) updateData.minParticipants = data.minParticipants ?? null
    if (data.durationHours !== undefined) updateData.durationHours = data.durationHours ?? null
    if (data.certificateIssued !== undefined) updateData.certificateIssued = data.certificateIssued ?? null
    if (data.startDate) updateData.startsAt = new Date(data.startDate)
    if (data.endDate !== undefined) updateData.endsAt = data.endDate ? new Date(data.endDate) : null

    let newStatus = data.status

    if (ctx.organizerId && ctx.isAdmin) {
      const newOrganizerProfile = await organizerRepository.findByUserId(ctx.organizerId)
      if (!newOrganizerProfile) {
        throw new ValidationError('Selected organizer profile not found')
      }
      updateData.organizer = { connect: { id: newOrganizerProfile.id } }
    }

    const criticalChanged = Object.keys(data).some(key =>
      (CRITICAL_FIELDS as readonly string[]).includes(key),
    )

    // Non-null exactly when this update pulled a published group back into moderation; the
    // list names what really changed and is only used to word that message.
    let autoRevertedFields: string[] | null = null

    if (existing.status === 'PUBLISHED' && criticalChanged && !newStatus) {
      newStatus = 'PENDING_REVIEW'
      autoRevertedFields = diffCriticalFields(existing, data)
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
        const existingOrganizerUserId = existing.organizer!.userId
        const effectiveOrganizerUserId = (ctx.organizerId && ctx.isAdmin)
          ? (await organizerRepository.findProfileById(ctx.organizerId, tx))?.userId ?? existingOrganizerUserId
          : existingOrganizerUserId

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

    // Deliberately after commit. The notification fans out to one fire-and-forget email
    // per admin, which a rollback cannot undo, and the transaction still validates
    // questions and co-organizers below the update — so notifying inside it could tell
    // admins to moderate a change that never landed.
    if (shouldNotifyAdmins) {
      await notifyAdminsGroupPendingReview(result.title, result.slug)

      // One transition, two audiences: admins are asked to moderate, the owner is told the
      // group moved. An edit that undid a publication also says which fields caused it.
      const organizerUserId = existing.organizer.userId

      if (autoRevertedFields) {
        await notifyGroupAutoReverted(
          organizerUserId,
          result.title,
          result.slug,
          autoRevertedFields,
        )
      }
      else {
        await notifyGroupSubmitted(organizerUserId, result.title, result.slug)
      }
    }

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

    if (!updated.organizer) {
      throw new NotFoundError('Group organizer not found')
    }

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
