import { requireAuth } from '../../utils/auth'
import { applicationRepository } from '../../repositories/applicationRepository'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)

  const applications = await applicationRepository.findMyApplications(user.email)

  return {
    applications: applications.map(a => ({
      id: a.id,
      groupId: a.groupId,
      name: a.name,
      email: a.email,
      status: a.status,
      createdAt: a.createdAt,
      group: {
        title: a.group.title,
        slug: a.group.slug,
        startsAt: a.group.startsAt,
      },
      answersCount: a.answers.length,
    })),
  }
})
