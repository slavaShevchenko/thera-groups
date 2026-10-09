import { groupService } from '../../services/groupService'
import { mapGroupCard } from '../../utils/groupResponse'

export default defineEventHandler(async () => {
  const groups = await groupService.getLatestGroups()

  return groups.map(mapGroupCard)
})
