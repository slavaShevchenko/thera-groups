import { requireAuth } from '../../utils/auth'
import { prisma } from '../../utils/prisma'
import { apiError } from '../../utils/apiError'
import { ErrorCodes } from '../../utils/errorCodes'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const slug = getRouterParam(event, 'slug')

  if (!slug) {
    throw apiError(400, ErrorCodes.VALIDATION_FAILED, 'Slug is required')
  }

  const group = await prisma.group.findUnique({
    where: { slug },
    include: { organizer: true },
  })

  if (!group) {
    throw apiError(404, ErrorCodes.NOT_FOUND, 'Group not found')
  }

  if (group.organizer.userId !== user.id && user.role !== 'ADMIN') {
    throw apiError(403, ErrorCodes.FORBIDDEN, 'Forbidden')
  }

  if (group.status !== 'DRAFT' && group.status !== 'REJECTED') {
    throw apiError(403, ErrorCodes.FORBIDDEN, 'Only draft or rejected groups can be deleted')
  }

  await prisma.group.delete({ where: { id: group.id } })

  return { success: true }
})
