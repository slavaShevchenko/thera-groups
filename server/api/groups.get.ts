import { groupService } from '../services/groupService'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)

  const filters = {
    q: typeof query.q === 'string' ? query.q : undefined,
    type: typeof query.type === 'string' ? query.type : undefined,
    format: typeof query.format === 'string' ? query.format : undefined,
    dateFrom: typeof query.dateFrom === 'string' ? query.dateFrom : undefined,
  }

  return groupService.getPublishedGroups(filters)
})
