import { groupRepository } from '../../repositories/groupRepository'
import { favoriteRepository } from '../../repositories/favoriteRepository'
import { getUser } from '../../utils/auth'
import { apiError } from '../../utils/apiError'
import { ErrorCodes } from '../../utils/errorCodes'
import { mapGroupForPublic } from '../../utils/groupResponse'
import { can } from '~~/shared/utils/permissions'

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug')

  if (!slug) {
    throw apiError(400, ErrorCodes.VALIDATION_FAILED, 'Group slug is required')
  }

  const user = await getUser(event)

  const viewer = user ? { userId: user.id, role: user.role } : undefined
  const group = await groupRepository.findBySlug(slug, viewer)

  if (!group) {
    throw apiError(404, ErrorCodes.NOT_FOUND, 'Group not found')
  }

  let isFavorited = false
  if (user) {
    const favorite = await favoriteRepository.findByUserAndGroup(user.id, group.id)
    isFavorited = !!favorite
  }

  // Decided here, over the raw row, and sent as booleans: the client used to receive
  // `organizer.userId` and every `coOrganizers[].userId` purely so it could re-run these
  // two checks itself, which put the ids in an anonymous visitor's response too.
  const resource = {
    status: group.status,
    organizerUserId: group.organizer?.userId,
    coOrganizerUserIds: group.coOrganizers.map(co => co.userId),
  }

  return mapGroupForPublic(group, {
    isFavorited,
    canEdit: can('group.edit', user, resource),
    canViewUnpublished: can('group.view', user, resource),
  })
})
