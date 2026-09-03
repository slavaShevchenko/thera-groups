import { requireRole } from '../../../utils/auth'
import { prisma } from '../../../utils/prisma'

export default defineEventHandler(async (event) => {
  await requireRole(event, ['ADMIN'])

  const profiles = await prisma.organizerProfile.findMany({
    where: { verificationStatus: 'PENDING' },
    include: {
      user: { select: { email: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  return profiles.map(p => ({
    id: p.id,
    slug: p.slug,
    firstName: p.firstName,
    lastName: p.lastName,
    email: p.user.email,
    bio: p.bio,
    qualification: p.qualification,
    avatarUrl: p.avatarUrl,
    city: p.city,
    experienceYears: p.experienceYears,
    specializations: p.specializations,
    createdAt: p.createdAt,
  }))
})
