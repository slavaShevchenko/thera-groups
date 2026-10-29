import { requireAuth } from '../../utils/auth'
import { applicationRepository } from '../../repositories/applicationRepository'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)

  const applications = await applicationRepository.findMyApplications({
    userId: user.id,
    email: user.email,
  })

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
        // Exposed so the page can tell a link that resolves from one that does not: a
        // CANCELLED group answers 404 by design, and DRAFT/PENDING_REVIEW/REJECTED were
        // never public, so linking to any of them sent the applicant to an error page.
        status: a.group.status,
        startsAt: a.group.startsAt,
      },
      answersCount: a.answers.length,
    })),
  }
})
