import { requireAuth } from '../../utils/auth'
import { prisma } from '../../utils/prisma'

export default defineEventHandler(async (event) => {
  await requireAuth(event)

  const query = getQuery(event)
  const q = typeof query.q === 'string' ? query.q : ''

  if (q.length < 2) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Query must be at least 2 characters',
    })
  }

  const excludeParam = typeof query.exclude === 'string' ? query.exclude : ''
  const excludeIds = excludeParam
    ? excludeParam.split(',').map(id => id.trim()).filter(Boolean)
    : []

  const users = await prisma.user.findMany({
    where: {
      role: 'ORGANIZER',
      isActive: true,
      ...(excludeIds.length > 0 && {
        id: { notIn: excludeIds },
      }),
      OR: [
        { organizerProfile: { firstName: { contains: q, mode: 'insensitive' } } },
        { organizerProfile: { lastName: { contains: q, mode: 'insensitive' } } },
        { email: { contains: q, mode: 'insensitive' } },
      ],
    },
    select: {
      id: true,
      email: true,
      organizerProfile: {
        select: {
          firstName: true,
          lastName: true,
          avatarUrl: true,
          slug: true,
        },
      },
    },
    take: 10,
  })

  return users.map(u => ({
    id: u.id,
    firstName: u.organizerProfile?.firstName ?? '',
    lastName: u.organizerProfile?.lastName ?? '',
    email: u.email,
    avatarUrl: u.organizerProfile?.avatarUrl ?? null,
    slug: u.organizerProfile?.slug ?? null,
  }))
})
