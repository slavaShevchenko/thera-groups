import { groupRepository } from '../repositories/groupRepository'

export const groupService = {
  async getPublishedGroups() {
    return groupRepository.findPublished()
  },

  async getLatestGroups(limit = 8) {
    return groupRepository.findLatest(limit)
  },

  async getGroupBySlug(slug: string) {
    const group = await groupRepository.findBySlug(slug)

    if (!group) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Group not found',
      })
    }

    return group
  },
}
