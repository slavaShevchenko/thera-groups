import { groupService } from '../../services/groupService'

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug')

  if (!slug) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Group slug is required',
    })
  }

  return groupService.getGroupBySlug(slug)
})
