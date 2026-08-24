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
  })

  if (!therapist) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Therapist not found',
    })
  }

  if (therapist.verificationStatus !== 'PENDING') {
    throw createError({
      statusCode: 409,
      statusMessage: `Therapist is not pending (current status: ${therapist.verificationStatus})`,
    })
  }

  const updated = await prisma.therapistProfile.update({
    where: { id },
    data: { verificationStatus: 'VERIFIED' },
  })

  return {
    id: updated.id,
    verificationStatus: updated.verificationStatus,
  }
})
