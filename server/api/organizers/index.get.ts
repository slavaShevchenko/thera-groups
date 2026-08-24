import { prisma } from '../../utils/prisma'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const specialization = query.specialization as string | undefined
  const city = query.city as string | undefined
  const format = query.format as string | undefined

  const where: Record<string, unknown> = {
    verificationStatus: 'VERIFIED',
    user: { isActive: true },
  }

  if (specialization) {
    where.specializations = { some: { slug: specialization } }
  }

  if (city) {
    where.city = { contains: city, mode: 'insensitive' }
  }

  if (format) {
    where.workFormats = { has: format }
  }

  const organizers = await prisma.organizerProfile.findMany({
    where,
    select: {
      id: true,
      firstName: true,
      lastName: true,
      slug: true,
      avatarUrl: true,
      city: true,
      experienceYears: true,
      specializations: {
        select: { id: true, nameUa: true, nameEn: true, slug: true },
      },
      _count: {
        select: {
          groups: {
            where: { status: 'PUBLISHED' },
          },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  return organizers.map(o => ({
    id: o.id,
    firstName: o.firstName,
    lastName: o.lastName,
    slug: o.slug,
    avatarUrl: o.avatarUrl,
    city: o.city,
    experienceYears: o.experienceYears,
    specializations: o.specializations,
    groupsCount: o._count.groups,
  }))
})
