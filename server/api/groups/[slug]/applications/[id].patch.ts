import { z } from 'zod'
import { prisma } from '../../../../utils/prisma'
import { requireAuth } from '../../../../utils/auth'
import { applicationStatusSchema } from '../../../../validators/application'
import { notifyApplicationStatusChanged } from '../../../../utils/notifications'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const slug = getRouterParam(event, 'slug')
  const applicationId = getRouterParam(event, 'id')

  if (!applicationId) {
    throw createError({ statusCode: 400, statusMessage: 'Application ID is required' })
  }

  const group = await prisma.group.findUnique({
    where: { slug },
    select: {
      id: true,
      organizer: { select: { userId: true } },
    },
  })

  if (!group) {
    throw createError({ statusCode: 404, statusMessage: 'Group not found' })
  }

  if (group.organizer.userId !== user.id && user.role !== 'ADMIN') {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }

  const body = await readBody(event)

  let data
  try {
    data = applicationStatusSchema.parse(body)
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

  const application = await prisma.application.findFirst({
    where: {
      id: applicationId,
      groupId: group.id,
    },
  })

  if (!application) {
    throw createError({ statusCode: 404, statusMessage: 'Application not found' })
  }

  const updated = await prisma.application.update({
    where: { id: applicationId },
    data: { status: data.status },
    select: {
      id: true,
      name: true,
      email: true,
      status: true,
      createdAt: true,
    },
  })

  const groupData = await prisma.group.findUnique({
    where: { id: group.id },
    select: { title: true, slug: true },
  })

  if (groupData) {
    await notifyApplicationStatusChanged(
      updated.email,
      groupData.title,
      groupData.slug,
      data.status,
    )
  }

  return { application: updated }
})
