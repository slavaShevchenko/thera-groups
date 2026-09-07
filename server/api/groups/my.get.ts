import { requireAuth } from '../../utils/auth'
import { prisma } from '../../utils/prisma'

const coOrganizersInclude = {
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
}

function mapGroup(g: Record<string, unknown>, role: 'owner' | 'coOrganizer') {
  const coOrganizers = (g.coOrganizers as Array<{ userId: string, role: string, sortOrder: number, user: { organizerProfile: { firstName: string, lastName: string, avatarUrl: string | null, slug: string | null } | null } }>) || []
  return {
    id: g.id as string,
    slug: g.slug as string,
    title: g.title as string,
    status: g.status as string,
    format: g.format as string | null,
    type: g.type as string | null,
    startsAt: g.startsAt as string | null,
    applicationsCount: (g._count as Record<string, number>)?.applications ?? 0,
    rejectionReason: g.rejectionReason as string | null,
    role,
    coOrganizers: coOrganizers.map(co => ({
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
    createdAt: g.createdAt as string,
  }
}

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)

  const profile = await prisma.organizerProfile.findUnique({
    where: { userId: user.id },
  })

  const ownedGroups = profile
    ? await prisma.group.findMany({
        where: { organizerId: profile.id },
        include: { coOrganizers: coOrganizersInclude, _count: { select: { applications: true } } },
        orderBy: { createdAt: 'desc' },
      })
    : []

  const coOrganizedGroups = await prisma.group.findMany({
    where: {
      coOrganizers: { some: { userId: user.id } },
      ...(profile ? { organizerId: { not: profile.id } } : {}),
    },
    include: {
      organizer: { select: { userId: true, firstName: true, lastName: true, avatarUrl: true, slug: true } },
      coOrganizers: coOrganizersInclude,
      _count: { select: { applications: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  return {
    owned: ownedGroups.map(g => mapGroup(g as unknown as Record<string, unknown>, 'owner')),
    coOrganized: coOrganizedGroups.map((g) => {
      const mapped = mapGroup(g as unknown as Record<string, unknown>, 'coOrganizer')
      const organizer = g.organizer as { firstName: string, lastName: string }
      return {
        ...mapped,
        ownerName: `${organizer.firstName} ${organizer.lastName}`,
      }
    }),
  }
})
