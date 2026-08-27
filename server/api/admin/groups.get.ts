import { requireRole } from '../../utils/auth'
import { prisma } from '../../utils/prisma'

export default defineEventHandler(async (event) => {
  await requireRole(event, ['ADMIN'])

  const query = getQuery(event)
  const status = typeof query.status === 'string' ? query.status : undefined

  const groups = await prisma.group.findMany({
    where: {
      ...(status && { status }),
    },
    include: {
      organizer: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          slug: true,
          avatarUrl: true,
        },
      },
    },
    orderBy: {
      updatedAt: 'desc',
    },
  })

  return groups.map(g => ({
    id: g.id,
    slug: g.slug,
    title: g.title,
    status: g.status,
    type: g.type,
    format: g.format,
    startsAt: g.startsAt,
    rejectionReason: g.rejectionReason,
    organizer: {
      id: g.organizer.id,
      name: `${g.organizer.firstName} ${g.organizer.lastName}`,
      slug: g.organizer.slug,
      avatarUrl: g.organizer.avatarUrl,
    },
    createdAt: g.createdAt,
    updatedAt: g.updatedAt,
  }))
})
