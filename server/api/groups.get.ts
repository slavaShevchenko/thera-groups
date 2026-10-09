import { groupService } from '../services/groupService'
import { groupsQuerySchema } from '../validators/query'
import { apiError } from '../utils/apiError'
import { ErrorCodes } from '../utils/errorCodes'
import { mapGroupCard } from '../utils/groupResponse'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const parsed = groupsQuerySchema.safeParse(query)
  if (!parsed.success) {
    throw apiError(400, ErrorCodes.VALIDATION_FAILED, 'Invalid query parameters')
  }

  const { page, limit } = parsed.data
  const skip = (page - 1) * limit

  const filters = {
    q: parsed.data.q,
    type: parsed.data.type,
    format: parsed.data.format,
    dateFrom: parsed.data.dateFrom,
  }

  const { groups, total } = await groupService.getPublishedGroups(filters, { skip, take: limit })

  return {
    groups: groups.map(mapGroupCard),
    total,
    page,
    totalPages: Math.ceil(total / limit),
  }
})
