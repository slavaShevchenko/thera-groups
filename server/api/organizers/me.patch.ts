import { z } from 'zod'
import { requireAuth } from '../../utils/auth'
import { prisma } from '../../utils/prisma'
import { updateOrganizerProfileSchema } from '../../validators/organizerProfile'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)

  let profile = await prisma.organizerProfile.findUnique({
    where: { userId: user.id },
  })

  const body = await readBody(event)

  let data
  try {
    data = updateOrganizerProfileSchema.parse(body)
  }
  catch (error) {
    if (error instanceof z.ZodError) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Validation failed',
        data: { details: error.issues },
      })
    }
    throw error
  }

  const { specializations, ...rest } = data

  const updateData: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(rest)) {
    if (value !== undefined) {
      updateData[key] = value === '' ? null : value
    }
  }

  const newFirstName = (updateData.firstName as string) ?? profile?.firstName ?? ''
  const newLastName = (updateData.lastName as string) ?? profile?.lastName ?? ''

  if (newFirstName !== (profile?.firstName ?? '') || newLastName !== (profile?.lastName ?? '')) {
    const baseSlug = `${newFirstName}-${newLastName}`
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')

    let slug = baseSlug
    let suffix = 1

    while (await prisma.organizerProfile.findUnique({ where: { slug } })) {
      if (profile && slug === profile.slug) break
      slug = `${baseSlug}-${suffix++}`
    }

    updateData.slug = slug
  }

  if (specializations !== undefined) {
    const seen = new Set<string>()
    const unique = specializations
      .map(s => s.trim())
      .filter(s => s.length > 0 && s.length <= 60)
      .filter((s) => {
        const lower = s.toLowerCase()
        if (seen.has(lower)) return false
        seen.add(lower)
        return true
      })
      .slice(0, 20)

    updateData.specializations = unique
  }

  if (!profile) {
    profile = await prisma.organizerProfile.create({
      data: {
        userId: user.id,
        slug: (updateData.slug as string) || `${user.email?.split('@')[0] ?? 'user'}`,
        firstName: newFirstName || 'User',
        lastName: newLastName || '',
        ...updateData,
      },
    })
  }
  else {
    profile = await prisma.organizerProfile.update({
      where: { id: profile.id },
      data: updateData,
    })
  }

  return {
    id: profile.id,
    slug: profile.slug,
    firstName: profile.firstName,
    lastName: profile.lastName,
    bio: profile.bio,
    qualification: profile.qualification,
    avatarUrl: profile.avatarUrl,
    experienceYears: profile.experienceYears,
    languages: profile.languages,
    workFormats: profile.workFormats,
    city: profile.city,
    education: profile.education,
    telegramUrl: profile.telegramUrl,
    instagramUrl: profile.instagramUrl,
    linkedinUrl: profile.linkedinUrl,
    whatsappUrl: profile.whatsappUrl,
    facebookUrl: profile.facebookUrl,
    youtubeUrl: profile.youtubeUrl,
    tiktokUrl: profile.tiktokUrl,
    verificationStatus: profile.verificationStatus,
    specializations: profile.specializations,
  }
})
