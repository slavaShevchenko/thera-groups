import { requireAuth } from '../../utils/auth'
import { groupRepository } from '../../repositories/groupRepository'
import { apiError } from '../../utils/apiError'
import { ErrorCodes } from '../../utils/errorCodes'
import { mapPrismaError } from '../../utils/errorHandler'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const slug = getRouterParam(event, 'slug')

  if (!slug) {
    throw apiError(400, ErrorCodes.VALIDATION_FAILED, 'Slug is required')
  }

  try {
    const group = await groupRepository.findBySlugWithOrganizer(slug)

    if (!group || !group.organizer) {
      throw apiError(404, ErrorCodes.NOT_FOUND, 'Group not found')
    }

    const isOwner = group.organizer.userId === user.id
    const isAdmin = user.role === 'ADMIN'
    const isCoOrganizer = await groupRepository.hasCoOrganizer(group.id, user.id)

    if (!isOwner && !isAdmin && !isCoOrganizer) {
      throw apiError(403, ErrorCodes.FORBIDDEN, 'Forbidden')
    }

    if (group.status !== 'DRAFT' && group.status !== 'REJECTED') {
      throw apiError(403, ErrorCodes.FORBIDDEN, 'Only draft or rejected groups can be deleted')
    }

    await groupRepository.deleteById(group.id)

    return { success: true }
  }
  catch (error) {
    if (error && typeof error === 'object' && 'statusCode' in error) throw error
    throw mapPrismaError(error, 'groups.delete')
  }
})
