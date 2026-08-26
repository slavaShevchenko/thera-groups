import { z } from 'zod'

const schema = z.object({
  locale: z.enum(['ua', 'en']),
})

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  schema.parse(body)

  return { success: true }
})
