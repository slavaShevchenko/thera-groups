import { z } from 'zod'

const schema = z.object({
  locale: z.enum(['ua', 'en']),
})

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { locale } = schema.parse(body)

  // TODO: Сохранять в профиль пользователя, когда будет авторизация
  // Пока просто возвращаем успех
  return { success: true }
})
