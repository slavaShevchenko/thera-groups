import { z } from 'zod'
import { requireAuth } from '../../utils/auth'
import { prisma } from '../../utils/prisma'
import { updateGroupSchema } from '../../validators/group'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const slug = getRouterParam(event, 'slug')

  if (!slug) {
    throw createError({ statusCode: 400, statusMessage: 'Slug is required' })
  }

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

  const isOwner = existing.organizer.userId === user.id
  const isAdmin = user.role === 'ADMIN'
  const isCoOrganizer = existing.coOrganizers.some(c => c.userId === user.id)

  if (!isOwner && !isAdmin && !isCoOrganizer) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }

  const body = await readBody(event)

  let data
  try {
    data = updateGroupSchema.parse(body)
  }
  catch (error) {
    if (error instanceof z.ZodError) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Validation failed',
        data: { details: error.issues },
      })
    }
    throw error
  }

  // Validate tags
  if (data.tagIds) {
    const tags = await prisma.groupTag.findMany({ where: { id: { in: data.tagIds } } })
    if (tags.length !== data.tagIds.length) {
      throw createError({ statusCode: 400, statusMessage: 'Some tags not found' })
    }
  }

  // Co-organizer can edit common fields but not status or co-organizers.
  // UI hides these controls, but autosave sends the full payload — silently ignore restricted fields.
  if (isCoOrganizer && !isOwner && !isAdmin) {
    delete data.coOrganizers
    delete data.status
  }

  // Moderation: организатор не может публиковать напрямую
  if (data.status === 'PUBLISHED' && user.role !== 'ADMIN') {
    throw createError({
      statusCode: 403,
      statusMessage: 'Only admins can publish groups. Use PENDING_REVIEW instead.',
    })
  }

  // Organizer can submit for review from DRAFT or REJECTED
  if (data.status === 'PENDING_REVIEW' && user.role !== 'ADMIN') {
    if (existing.status !== 'DRAFT' && existing.status !== 'PENDING_REVIEW' && existing.status !== 'REJECTED') {
      throw createError({
        statusCode: 400,
        statusMessage: 'Can only submit DRAFT or REJECTED groups for review',
      })
    }
  }

  // Organizer cannot edit a published group
  if (existing.status === 'PUBLISHED' && user.role !== 'ADMIN') {
    // Allow only if status is unchanged
    if (data.status !== undefined && data.status !== existing.status) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Cannot change status of published group. Contact admin.',
      })
    }
  }

  // Build update data — map fields correctly
  const updateData: Record<string, unknown> = {}

  // Direct fields (no transformation)
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
    // On resubmission for review — clear rejection reason
    if (data.status === 'PENDING_REVIEW') {
      updateData.rejectionReason = null
    }
  }

  // Fields with name transformation
  if (data.maxParticipants !== undefined) updateData.capacity = data.maxParticipants ?? 10

  // Date — convert string to Date
  if (data.startDate) updateData.startsAt = new Date(data.startDate)
  if (data.endDate) updateData.endsAt = new Date(data.endDate)

  // Admin: change group organizer
  const rawBody = body as Record<string, unknown>
  if (rawBody.organizerId && user.role === 'ADMIN') {
    const newOrganizerUserId = rawBody.organizerId as string
    const newOrganizerProfile = await prisma.organizerProfile.findUnique({
      where: { userId: newOrganizerUserId },
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
    const { notifyAdminsGroupPendingReview } = await import('../../utils/notifications')
    await notifyAdminsGroupPendingReview(updated.title, updated.slug)
  }

  // Update questions if provided
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

  // Update co-organizers if provided
  if (data.coOrganizers !== undefined) {
    // Determine the current organizer (after possible admin change)
    const effectiveOrganizerUserId = (updateData.organizerId as string)
      ? (await prisma.organizerProfile.findUnique({
          where: { id: updateData.organizerId as string },
          select: { userId: true },
        }))?.userId ?? existing.organizer.userId
      : existing.organizer.userId

    // Server-side guard: exclude organizer from co-organizers
    const filteredCoOrganizers = data.coOrganizers.filter(c => c.userId !== effectiveOrganizerUserId)

    const userIds = filteredCoOrganizers.map(c => c.userId)

    // Deduplicate by userId
    const seen = new Set<string>()
    const uniqueCoOrganizers = filteredCoOrganizers.filter((c) => {
      if (seen.has(c.userId)) return false
      seen.add(c.userId)
      return true
    })

    // Validate each userId belongs to an active ORGANIZER
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

    // Delete all existing and recreate
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
})
