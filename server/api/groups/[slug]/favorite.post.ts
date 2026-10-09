import { requireAuth } from '../../../utils/auth'
import { favoriteRepository } from '../../../repositories/favoriteRepository'
import { applicationRepository } from '../../../repositories/applicationRepository'
import { apiError } from '../../../utils/apiError'
import { ErrorCodes } from '../../../utils/errorCodes'
import { isPublicGroupStatus } from '~~/shared/constants/groupStatus'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const slug = getRouterParam(event, 'slug')
  if (!slug) {
    throw apiError(400, ErrorCodes.VALIDATION_FAILED, 'Group slug is required')
  }

  const group = await applicationRepository.findPublishedBySlug(slug)

  // Whatever a visitor can open they can bookmark. The detail page shows the favorite
  // button on a FULL or COMPLETED group too, and saving a past event is precisely what
  // its archive page is for.
  if (!group || !isPublicGroupStatus(group.status)) {
    throw apiError(404, ErrorCodes.NOT_FOUND, 'Group not found')
  }

  const existing = await favoriteRepository.findByUserAndGroup(user.id, group.id)

  if (existing) {
    throw apiError(409, ErrorCodes.CONFLICT, 'Already in favorites')
  }

  await favoriteRepository.create(user.id, group.id)

  // The caller only needs to know it worked; echoing back userId and the group's cuid would
  // put two internal identifiers in a public response for no consumer.
  return { success: true }
})
