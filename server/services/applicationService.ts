import type { applySchema } from '../validators/application'
import type { z } from 'zod'
import { applicationRepository } from '../repositories/applicationRepository'
import { notifyApplicationReceived, notifyApplicationStatusChanged } from '../utils/notifications'
import { NotFoundError, ForbiddenError, ValidationError, ConflictError } from '../utils/domainErrors'

type ApplyInput = z.infer<typeof applySchema>

export const applicationService = {
  async create(slug: string, input: ApplyInput) {
    const group = await applicationRepository.findGroupWithQuestions(slug)

    if (!group || group.status !== 'PUBLISHED') {
      throw new NotFoundError('Group not found')
    }

    const questionsMap = new Map(group.questions.map(q => [q.id, q]))
    const answersMap = new Map(input.answers.map(a => [a.questionId, a.value]))

    for (const answer of input.answers) {
      if (!questionsMap.has(answer.questionId)) {
        throw new ValidationError(`Question ${answer.questionId} not found for this group`)
      }
    }

    for (const q of group.questions) {
      if (q.required) {
        const answer = answersMap.get(q.id)
        if (!answer || !answer.trim()) {
          throw new ValidationError(`Required question not answered: ${q.id}`)
        }
      }

      const answer = answersMap.get(q.id)
      if (!answer || !answer.trim()) continue

      if (q.type === 'SINGLE_CHOICE') {
        if (!q.options.includes(answer)) {
          throw new ValidationError(`Invalid option for "${q.question}"`)
        }
      }

      if (q.type === 'MULTIPLE_CHOICE') {
        const selected = answer.split(',').map(s => s.trim()).filter(Boolean)
        const invalid = selected.filter(v => !q.options.includes(v))
        if (invalid.length > 0) {
          throw new ValidationError(`Invalid options for "${q.question}": ${invalid.join(', ')}`)
        }
      }
    }

    const existing = await applicationRepository.findByGroupAndEmail(group.id, input.email)

    if (existing) {
      throw new ConflictError('Application failed')
    }

    const application = await applicationRepository.create({
      groupId: group.id,
      name: input.name,
      email: input.email,
      phone: input.phone,
      answers: input.answers.filter(a => a.value.trim()),
    })

    await notifyApplicationReceived(
      group.organizer.userId,
      input.name,
      group.title,
      group.slug,
      group.organizer.user.preferredLocale,
    )

    return { application }
  },

  async updateStatus(
    slug: string,
    applicationId: string,
    status: 'APPROVED' | 'REJECTED',
    ctx: { userId: string, isAdmin: boolean },
  ) {
    const group = await applicationRepository.findGroupWithOrganizer(slug)

    if (!group) {
      throw new NotFoundError('Group not found')
    }

    if (group.organizer.userId !== ctx.userId && !ctx.isAdmin) {
      throw new ForbiddenError()
    }

    const application = await applicationRepository.findByIdAndGroup(applicationId, group.id)

    if (!application) {
      throw new NotFoundError('Application not found')
    }

    const updated = await applicationRepository.updateWithSelect(
      applicationId,
      { status },
    )

    await notifyApplicationStatusChanged(
      updated.email,
      group.title,
      group.slug,
      status,
    )

    return { application: updated }
  },
}
