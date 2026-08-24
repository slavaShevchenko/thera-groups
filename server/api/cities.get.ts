import { prisma } from '../utils/prisma'

export default defineEventHandler(async () => {
  const organizers = await prisma.organizerProfile.findMany({
    where: {
      verificationStatus: 'VERIFIED',
      city: { not: null },
    },
    select: { city: true },
    distinct: ['city'],
    orderBy: { city: 'asc' },
  })

  return organizers
    .map(o => o.city)
    .filter((c): c is string => c !== null)
})
