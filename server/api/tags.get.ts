import { prisma } from '../utils/prisma'

export default defineEventHandler(async () => {
  const tags = await prisma.groupTag.findMany({
    orderBy: { name: 'asc' },
  })
  return tags.map(t => ({
    id: t.id,
    name: t.name,
    slug: t.slug,
  }))
})
