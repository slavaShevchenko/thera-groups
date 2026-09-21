import { requireAuth } from '../../../utils/auth'
import { favoriteRepository } from '../../../repositories/favoriteRepository'
import { applicationRepository } from '../../../repositories/applicationRepository'
import { apiError } from '../../../utils/apiError'
import { ErrorCodes } from '../../../utils/errorCodes'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const slug = getRouterParam(event, 'slug')

  const group = await applicationRepository.findPublishedBySlug(slug)

  if (!group || group.status !== 'PUBLISHED') {
    throw apiError(404, ErrorCodes.NOT_FOUND, 'Group not found')
  }

  const existing = await favoriteRepository.findByUserAndGroup(user.id, group.id)

  if (existing) {
    throw apiError(409, ErrorCodes.CONFLICT, 'Already in favorites')
  }

  const favorite = await favoriteRepository.create(user.id, group.id)

  return { favorite: { userId: favorite.userId, groupId: favorite.groupId } }
})
