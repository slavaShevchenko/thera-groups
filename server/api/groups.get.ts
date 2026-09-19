import { groupService } from '../services/groupService'
import { parsePagination } from '../utils/pagination'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const { page, limit, skip } = parsePagination(query as Record<string, unknown>)

  const filters = {
    q: typeof query.q === 'string' ? query.q : undefined,
    type: typeof query.type === 'string' ? query.type : undefined,
    format: typeof query.format === 'string' ? query.format : undefined,
    dateFrom: typeof query.dateFrom === 'string' ? query.dateFrom : undefined,
  }

  const { groups, total } = await groupService.getPublishedGroups(filters, { skip, take: limit })

  return {
    groups,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  }
})
