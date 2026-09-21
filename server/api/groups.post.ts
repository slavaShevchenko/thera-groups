import { requireAuth } from '../utils/auth'
import { groupService } from '../services/groupService'
import { groupRepository } from '../repositories/groupRepository'
import { organizerRepository } from '../repositories/organizerRepository'
import { generateUniqueSlug } from '../utils/slugify'
import { mapDomainError } from '../utils/mapDomainError'
import { DomainError, ForbiddenError, ValidationError } from '../utils/domainErrors'
import { mapPrismaError } from '../utils/errorHandler'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)

  let organizerId: string

  try {
    if (user.role === 'ADMIN') {
      const body = await readBody(event) as Record<string, unknown> | null
      if (body?.organizerId && typeof body.organizerId === 'string') {
        organizerId = body.organizerId
      }
      else {
        const profiles = await organizerRepository.findPendingVerification()
        const firstProfile = profiles[0]
        if (!firstProfile) {
          throw new ValidationError('No verified organizers available')
        }
        organizerId = firstProfile.id
      }
    }
    else {
      const profile = await organizerRepository.findByUserId(user.id)
      if (!profile || profile.verificationStatus !== 'VERIFIED') {
        throw new ForbiddenError('Only verified organizers can create groups')
      }
      organizerId = profile.id
    }

    const slug = await generateUniqueSlug(
      'new-group',
      s => groupRepository.slugExists(s),
    )

    const group = await groupService.create({ organizerId, slug })

    return {
      success: true,
      group: { id: group.id, slug: group.slug, title: group.title, status: group.status },
    }
  }
  catch (error) {
    if (error instanceof DomainError) mapDomainError(error)
    throw mapPrismaError(error, 'groups.post')
  }
})
