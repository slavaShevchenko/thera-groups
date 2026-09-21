import { groupRepository } from '../../repositories/groupRepository'
import { favoriteRepository } from '../../repositories/favoriteRepository'
import { getUser } from '../../utils/auth'
import { apiError } from '../../utils/apiError'
import { ErrorCodes } from '../../utils/errorCodes'

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

  return {
    id: group.id,
    slug: group.slug,
    title: group.title,
    description: group.description,
    type: group.type,
    format: group.format,
    location: group.location,
    startsAt: group.startsAt,
    endsAt: group.endsAt,
    capacity: group.capacity,
    priceAmount: group.priceAmount,
    currency: group.currency,
    status: group.status,
    createdAt: group.createdAt,
    tags: group.tags.map(tag => ({ id: tag.id, name: tag.name, slug: tag.slug })),
    organizer: group.organizer
      ? {
          id: group.organizer.id,
          userId: group.organizer.userId,
          firstName: group.organizer.firstName,
          lastName: group.organizer.lastName,
          slug: group.organizer.slug,
          avatarUrl: group.organizer.avatarUrl,
          qualification: group.organizer.qualification,
          experienceYears: group.organizer.experienceYears,
          bio: group.organizer.bio,
        }
      : null,
    coOrganizers: group.coOrganizers.map(co => ({
      userId: co.userId,
      role: co.role,
      user: {
        firstName: co.user?.organizerProfile?.firstName ?? '',
        lastName: co.user?.organizerProfile?.lastName ?? '',
        avatarUrl: co.user?.organizerProfile?.avatarUrl ?? null,
        slug: co.user?.organizerProfile?.slug ?? null,
      },
    })),
    isFavorited,
  }
})
