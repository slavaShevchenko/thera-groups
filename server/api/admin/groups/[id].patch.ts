import { z } from 'zod'
import { requireRole } from '../../../utils/auth'
import { prisma } from '../../../utils/prisma'

const adminGroupStatusSchema = z.object({
  status: z.enum(['PUBLISHED', 'DRAFT']),
  rejectionReason: z.string().max(1000).optional(),
})

export default defineEventHandler(async (event) => {
  await requireRole(event, ['ADMIN'])

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Group ID is required' })
  }

  const body = await readBody(event)

  let data
  try {
    data = adminGroupStatusSchema.parse(body)
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

  const group = await prisma.group.findUnique({
    where: { id },
    select: { id: true, status: true },
  })

  if (!group) {
    throw createError({ statusCode: 404, statusMessage: 'Group not found' })
  }

  // Только группы на модерации можно approve/reject
  if (group.status !== 'PENDING_REVIEW') {
    throw createError({
      statusCode: 400,
      statusMessage: 'Only groups with PENDING_REVIEW status can be moderated',
    })
  }

  // При отклонении нужна причина
  if (data.status === 'DRAFT' && !data.rejectionReason?.trim()) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Rejection reason is required when rejecting a group',
    })
  }

  const updated = await prisma.group.update({
    where: { id },
    data: {
      status: data.status,
      rejectionReason: data.status === 'DRAFT' ? data.rejectionReason : null,
    },
    select: {
      id: true,
      slug: true,
      title: true,
      status: true,
      rejectionReason: true,
    },
  })

  return { group: updated }
})
