import { requireAuth } from '../utils/auth'
import { requirePermission } from '../utils/permissions'
import { prisma } from '../utils/prisma'
import { generateUniqueSlug } from '../utils/slugify'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  requirePermission(user, 'group.create')

  let organizerId: string

  if (user.role === 'ADMIN') {
    // Адмін створює порожню групу без прив'язки до організатора — організатора буде обрано пізніше
    const slug = await generateUniqueSlug(
      'new-group',
      s => prisma.group.findUnique({ where: { slug: s } }).then(Boolean),
    )

    // Створюємо з тимчасовим organizerId = перший знайдений VERIFIED організатор
    const firstProfile = await prisma.organizerProfile.findFirst({
      where: { verificationStatus: 'VERIFIED' },
    })

    if (!firstProfile) {
      throw createError({ statusCode: 400, statusMessage: 'No verified organizers available' })
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
