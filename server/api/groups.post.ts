import { requireAuth } from '../utils/auth'
import { groupService } from '../services/groupService'
import { groupRepository } from '../repositories/groupRepository'
import { organizerRepository } from '../repositories/organizerRepository'
import { generateUniqueSlug } from '../utils/slugify'
import { createGroupSchema } from '../validators/group'
import { mapDomainError } from '../utils/mapDomainError'
import { DomainError, ForbiddenError, NotFoundError, ValidationError } from '../utils/domainErrors'
import { mapPrismaError } from '../utils/errorHandler'
import { apiError } from '../utils/apiError'
import { ErrorCodes } from '../utils/errorCodes'

/**
 * The organizer an ADMIN creates on behalf of.
 *
 * Always explicit. There used to be a fallback that picked the oldest profile waiting for
 * verification, which silently attributed a new group to a stranger and made the review
 * queue order a security-relevant input.
 */
async function resolveAdminOrganizerId(organizerId: string | undefined): Promise<string> {
  if (!organizerId) {
    throw new ValidationError('organizerId is required', 'organizerId')
  }

  const profile = await organizerRepository.findById(organizerId)
  if (!profile) {
    throw new NotFoundError('Organizer profile not found')
  }
  if (profile.verificationStatus !== 'VERIFIED') {
    throw new ValidationError('Organizer profile is not verified', 'organizerId')
  }

  return profile.id
}

async function resolveOwnOrganizerId(userId: string): Promise<string> {
  const profile = await organizerRepository.findByUserId(userId)
  if (!profile || profile.verificationStatus !== 'VERIFIED') {
    throw new ForbiddenError('Only verified organizers can create groups')
  }

  return profile.id
}

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)

  // `new.vue` posts no body at all, so an empty payload is a valid request.
  const parsed = createGroupSchema.safeParse(await readBody(event) ?? {})
  if (!parsed.success) {
    throw apiError(400, ErrorCodes.VALIDATION_FAILED, 'Validation failed', { details: parsed.error.issues })
  }

  try {
    // An organizerId supplied by a non-admin is ignored rather than rejected: the owner of
    // a draft is whoever creates it, and a crafted body must not be able to reassign one.
    const organizerId = user.role === 'ADMIN'
      ? await resolveAdminOrganizerId(parsed.data.organizerId)
      : await resolveOwnOrganizerId(user.id)

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
