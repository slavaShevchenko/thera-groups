import { requireAuth } from '../utils/auth'
import { requirePermission } from '../utils/permissions'
import { prisma } from '../utils/prisma'
import { generateUniqueSlug } from '../utils/slugify'
import { apiError } from '../utils/apiError'
import { ErrorCodes } from '../utils/errorCodes'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  requirePermission(user, 'group.create')

  let organizerId: string

  if (user.role === 'ADMIN') {
    // Admin creates an empty group without binding to an organizer — organizer will be assigned later
    const slug = await generateUniqueSlug(
      'new-group',
      s => prisma.group.findUnique({ where: { slug: s } }).then(Boolean),
    )

    // Create with temporary organizerId = first found VERIFIED organizer
    const firstProfile = await prisma.organizerProfile.findFirst({
      where: { verificationStatus: 'VERIFIED' },
    })

    if (!firstProfile) {
      throw apiError(400, ErrorCodes.VALIDATION_FAILED, 'No verified organizers available')
    }

    organizerId = firstProfile.id

    const group = await prisma.group.create({
      data: {
        organizerId,
        title: '',
        slug,
        description: '',
        status: 'DRAFT',
      },
    })

    return {
      success: true,
      group: { id: group.id, slug: group.slug, title: group.title, status: group.status },
    }
  }

  const profile = await prisma.organizerProfile.findUnique({
    where: { userId: user.id },
  })

  if (!profile || profile.verificationStatus !== 'VERIFIED') {
    throw apiError(403, ErrorCodes.FORBIDDEN, 'Only verified organizers can create groups')
  }

  const slug = await generateUniqueSlug(
    'new-group',
    s => prisma.group.findUnique({ where: { slug: s } }).then(Boolean),
  )

  const group = await prisma.group.create({
    data: {
      organizerId: profile.id,
      title: '',
      slug,
      description: '',
      status: 'DRAFT',
    },
  })

  return {
    success: true,
    group: {
      id: group.id,
      slug: group.slug,
      title: group.title,
      status: group.status,
    },
  }
})
