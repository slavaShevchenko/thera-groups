import type { Filters } from '~~/types'
import { groupRepository } from '../repositories/groupRepository'

export const groupService = {
  async getPublishedGroups(filters?: Filters, pagination?: { skip?: number, take?: number }) {
    const [groups, total] = await Promise.all([
      groupRepository.findPublished(filters, pagination),
      groupRepository.countPublished(filters),
    ])
    return { groups, total }
  },

  async getLatestGroups(limit = 6) {
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
