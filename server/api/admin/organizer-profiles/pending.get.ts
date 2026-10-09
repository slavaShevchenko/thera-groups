import { requireAuth } from '../../../utils/auth'
import { requirePermission } from '../../../utils/permissions'
import { organizerRepository } from '../../../repositories/organizerRepository'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  requirePermission(user, 'admin.profiles.view')

  const profiles = await organizerRepository.findPendingVerification()

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
