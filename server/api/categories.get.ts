import { prisma } from '../utils/prisma'

export default defineEventHandler(async () => {
  const categories = await prisma.groupCategory.findMany({
    orderBy: { name: 'asc' },
  })
  return categories.map(c => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
  }))
})
