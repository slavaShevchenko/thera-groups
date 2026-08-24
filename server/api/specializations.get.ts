import { prisma } from '../utils/prisma'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const search = query.query as string | undefined

  const where = search
    ? {
        OR: [
          { nameUa: { contains: search, mode: 'insensitive' } },
          { nameEn: { contains: search, mode: 'insensitive' } },
        ],
      }
    : {}

  const specializations = await prisma.specialization.findMany({
    where,
    select: {
      id: true,
      nameUa: true,
      nameEn: true,
      slug: true,
    },
    orderBy: {
      nameUa: 'asc',
    },
  })

  return specializations
})
