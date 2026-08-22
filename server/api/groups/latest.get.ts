import { groupService } from '../../services/groupService'

export default defineEventHandler(() => {
  return groupService.getLatestGroups()
})
