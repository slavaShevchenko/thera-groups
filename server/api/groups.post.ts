import { requireRole } from '../utils/auth'
import { prisma } from '../utils/prisma'
import { generateUniqueSlug } from '../utils/slugify'

export default defineEventHandler(async (event) => {
  const user = await requireRole(event, ['ORGANIZER'])

  const profile = await prisma.organizerProfile.findUnique({
    where: { userId: user.id },
  })

  if (!profile || profile.verificationStatus !== 'VERIFIED') {
    throw createError({
      statusCode: 403,
      statusMessage: 'Only verified organizers can create groups',
    })
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
