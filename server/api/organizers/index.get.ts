import { organizerRepository } from '../../repositories/organizerRepository'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const city = query.city as string | undefined
  const format = query.format as string | undefined

  const organizers = await organizerRepository.findVerifiedOrganizers({ city, format })

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
