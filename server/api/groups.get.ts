import { groupService } from '../services/groupService'

export default defineEventHandler(async () => {
  return groupService.getPublishedGroups()
})
