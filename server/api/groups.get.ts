import { groupService } from '../services/groupService'
import { groupsQuerySchema } from '../validators/query'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const parsed = groupsQuerySchema.safeParse(query)
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid query parameters' })
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
    groups,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  }
})
