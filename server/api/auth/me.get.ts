import { getUser } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  const user = await getUser(event)

  // Return 200 with user: null for guests (instead of 401)
  return { user }
})
