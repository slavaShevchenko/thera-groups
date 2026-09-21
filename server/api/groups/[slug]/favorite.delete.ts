import { requireAuth } from '../../../utils/auth'
import { favoriteRepository } from '../../../repositories/favoriteRepository'
import { applicationRepository } from '../../../repositories/applicationRepository'
import { apiError } from '../../../utils/apiError'
import { ErrorCodes } from '../../../utils/errorCodes'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const slug = getRouterParam(event, 'slug')

  const group = await applicationRepository.findPublishedBySlug(slug)

  if (!group) {
    throw apiError(404, ErrorCodes.NOT_FOUND, 'Group not found')
  }

  const existing = await favoriteRepository.findByUserAndGroup(user.id, group.id)

  if (!existing) {
    throw apiError(404, ErrorCodes.NOT_FOUND, 'Not in favorites')
  }

  await favoriteRepository.remove(user.id, group.id)

  return { success: true }
})
