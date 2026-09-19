import { organizerRepository } from '../../repositories/organizerRepository'
import { organizersQuerySchema } from '../../validators/query'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const parsed = organizersQuerySchema.safeParse(query)
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid query parameters' })
  }

  const organizers = await organizerRepository.findVerifiedOrganizers({
    city: parsed.data.city,
    format: parsed.data.format,
  })

  return organizers.map(o => ({
    id: o.id,
    firstName: o.firstName,
    lastName: o.lastName,
    slug: o.slug,
    avatarUrl: o.avatarUrl,
    city: o.city,
    experienceYears: o.experienceYears,
    specializations: o.specializations,
    groupsCount: o._count.groups,
  }))
})
