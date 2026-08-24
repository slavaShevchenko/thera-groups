import { requireRole } from '../../../../utils/auth'
import { prisma } from '../../../../utils/prisma'

export default defineEventHandler(async (event) => {
  await requireRole(event, ['ADMIN'])

  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Therapist ID is required',
    })
  }

  const therapist = await prisma.therapistProfile.findUnique({
    where: { id },
    include: { user: true },
  })

  if (!therapist) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Therapist not found',
    })
  }

  const updated = await prisma.user.update({
    where: { id: therapist.userId },
    data: { isActive: !therapist.user.isActive },
  })

  return {
    id: therapist.id,
    isActive: updated.isActive,
  }
})
