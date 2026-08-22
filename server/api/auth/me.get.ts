import { getUser } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  const user = await getUser(event)

  // Возвращаем 200 с user: null для гостя (вместо 401)
  return { user }
})
