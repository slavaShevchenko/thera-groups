import { requireAuth } from '../../utils/auth'
import { favoriteRepository } from '../../repositories/favoriteRepository'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)

  const favorites = await favoriteRepository.findByUser(user.id)

  // A favorite outlives its group's organizer (`organizerId` is nullable, `ON DELETE SET
  // NULL`). Such a row is dropped instead of rendered nameless, and the drop is an explicit
  // guard rather than the non-null assertions it replaces — those would 500 the whole list
  // on the first organizer-less group.
  return favorites.flatMap((f) => {
    const organizer = f.group.organizer
    if (!organizer) return []

    return [{
      id: f.group.id,
      slug: f.group.slug,
      title: f.group.title,
      description: f.group.description,
      format: f.group.format,
      type: f.group.type,
      location: f.group.location,
      currency: f.group.currency,
      capacity: f.group.capacity,
      startsAt: f.group.startsAt,
      organizer: {
        firstName: organizer.firstName,
        lastName: organizer.lastName,
        avatarUrl: organizer.avatarUrl,
      },
      coOrganizers: f.group.coOrganizers.map(co => ({
        userId: co.userId,
        role: co.role,
        user: {
          id: co.user.id,
          organizerProfile: co.user.organizerProfile
            ? {
                firstName: co.user.organizerProfile.firstName,
                lastName: co.user.organizerProfile.lastName,
                avatarUrl: co.user.organizerProfile.avatarUrl,
                slug: co.user.organizerProfile.slug,
              }
            : null,
        },
      })),
      applicationsCount: f.group._count.applications,
      favoritedAt: f.createdAt,
    }]
  })
})
