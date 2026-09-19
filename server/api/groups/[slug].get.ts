import { groupService } from '../../services/groupService'
import { getUser } from '../../utils/auth'
import { prisma } from '../../utils/prisma'
import { can } from '~~/shared/utils/permissions'
import { apiError } from '../../utils/apiError'
import { ErrorCodes } from '../../utils/errorCodes'

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug')

  if (!slug) {
    throw apiError(400, ErrorCodes.VALIDATION_FAILED, 'Group slug is required')
  }

  const user = await getUser(event)

  const group = await groupService.getGroupBySlug(slug)

  const viewResource = {
    status: group.status,
    organizerUserId: group.organizer.userId,
    coOrganizerUserIds: group.coOrganizers.map((co: { userId: string }) => co.userId),
  }

  if (!can('group.view', user, viewResource)) {
    throw apiError(404, ErrorCodes.NOT_FOUND, 'Group not found')
  }

  // Check if the current user has favorited this group
  let isFavorited = false
  if (user) {
    const favorite = await prisma.favorite.findUnique({
      where: {
        userId_groupId: {
          userId: user.id,
          groupId: group.id,
        },
      },
    })
    isFavorited = !!favorite
  }

  const { coOrganizers, ...rest } = group

  return {
    ...rest,
    coOrganizers: coOrganizers.map((co: { userId: string, role: string, sortOrder: number, user: { organizerProfile: { firstName: string, lastName: string, avatarUrl: string | null, slug: string | null } | null } }) => ({
      userId: co.userId,
      role: co.role,
      sortOrder: co.sortOrder,
      user: {
        firstName: co.user.organizerProfile?.firstName ?? '',
        lastName: co.user.organizerProfile?.lastName ?? '',
        avatarUrl: co.user.organizerProfile?.avatarUrl ?? null,
        slug: co.user.organizerProfile?.slug ?? null,
      },
    })),
    isFavorited,
  }
})
