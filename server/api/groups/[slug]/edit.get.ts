import { requireAuth } from '../../../utils/auth'
import { prisma } from '../../../utils/prisma'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const slug = getRouterParam(event, 'slug')

  if (!slug) {
    throw createError({ statusCode: 400, statusMessage: 'Slug is required' })
  }

  const group = await prisma.group.findUnique({
    where: { slug },
    include: {
      organizer: true,
      tags: true,
      questions: { orderBy: { position: 'asc' } },
      coOrganizers: {
        include: {
          user: {
            select: {
              id: true,
              organizerProfile: {
                select: {
                  firstName: true,
                  lastName: true,
                  avatarUrl: true,
                  slug: true,
                },
              },
            },
          },
        },
      },
      _count: { select: { applications: true } },
    },
  })

  if (!group) {
    throw createError({ statusCode: 404, statusMessage: 'Group not found' })
  }

  if (group.organizer.userId !== user.id && user.role !== 'ADMIN') {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }

  return {
    id: group.id,
    slug: group.slug,
    organizerUserId: group.organizer.userId,
    title: group.title,
    description: group.description,
    status: group.status,
    format: group.format,
    type: group.type,
    location: group.location,
    startsAt: group.startsAt,
    endsAt: group.endsAt,
    timezone: group.timezone,
    capacity: group.capacity,
    price: group.price,
    currency: group.currency,
    tags: group.tags.map(t => ({ id: t.id, name: t.name, slug: t.slug })),
    questions: group.questions.map(q => ({
      id: q.id,
      question: q.question,
      type: q.type,
      required: q.required,
      position: q.position,
      options: q.options,
    })),
    rejectionReason: group.rejectionReason,
    applicationsCount: group._count.applications,
    coOrganizers: group.coOrganizers.map(co => ({
      userId: co.userId,
      role: co.role,
      sortOrder: co.sortOrder,
      user: {
        firstName: co.user.organizerProfile?.firstName ?? '',
        lastName: co.user.organizerProfile?.lastName ?? '',
        avatarUrl: co.user.organizerProfile?.avatarUrl ?? null,
        slug: co.user.organizerProfile?.slug ?? null,
      },
    })),
    createdAt: group.createdAt,
  }
})
