import { requireAuth } from '../../../../utils/auth'
import { requirePermission } from '../../../../utils/permissions'
import { organizerService } from '../../../../services/organizerService'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  requirePermission(user, 'admin.organizers.view')

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Organizer ID is required' })
  }

  return organizerService.toggleActive(id)
})
