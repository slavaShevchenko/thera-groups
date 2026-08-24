import { requireRole } from '../../../../utils/auth'
import { prisma } from '../../../../utils/prisma'

export default defineEventHandler(async (event) => {
  await requireRole(event, ['ADMIN'])

  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Organizer ID is required',
    })
  }

  const organizer = await prisma.organizerProfile.findUnique({
    where: { id },
  })

  if (!organizer) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Organizer not found',
    })
  }

  if (organizer.verificationStatus !== 'PENDING') {
    throw createError({
      statusCode: 409,
      statusMessage: `Organizer is not pending (current status: ${organizer.verificationStatus})`,
    })
  }

  const updated = await prisma.organizerProfile.update({
    where: { id },
    data: { verificationStatus: 'VERIFIED' },
  })

  return {
    id: updated.id,
    verificationStatus: updated.verificationStatus,
  }
})
