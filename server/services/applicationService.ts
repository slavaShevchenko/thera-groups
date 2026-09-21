import type { applySchema } from '../validators/application'
import type { z } from 'zod'
import { applicationRepository } from '../repositories/applicationRepository'
import { notifyApplicationReceived, notifyApplicationStatusChanged } from '../utils/notifications'

type ApplyInput = z.infer<typeof applySchema>

export const applicationService = {
  /**
   * Creates a new application for a published group after validating answers against the group's questions.
   * Checks for duplicate submissions by email and notifies the organizer on success.
   * @param slug - The URL-friendly group identifier
   * @param input - Application data including name, email, phone, and answers
   * @returns The created application record
   * @throws 404 if group not found or not published, 400 for invalid answers or duplicate email
   */
  async create(slug: string, input: ApplyInput) {
    const group = await applicationRepository.findGroupWithQuestions(slug)

    if (!group || group.status !== 'PUBLISHED') {
      throw createError({
        statusCode: 404,
        statusMessage: 'Group not found',
      })
    }

    const questionsMap = new Map(group.questions.map(q => [q.id, q]))
    const answersMap = new Map(input.answers.map(a => [a.questionId, a.value]))

    for (const answer of input.answers) {
      if (!questionsMap.has(answer.questionId)) {
        throw createError({
          statusCode: 400,
          statusMessage: `Question ${answer.questionId} not found for this group`,
        })
      }
    }

    for (const q of group.questions) {
      if (q.required) {
        const answer = answersMap.get(q.id)
        if (!answer || !answer.trim()) {
          throw createError({
            statusCode: 400,
            statusMessage: `Required question not answered: ${q.id}`,
          })
        }
      }

      const answer = answersMap.get(q.id)
      if (!answer || !answer.trim()) continue

      if (q.type === 'SINGLE_CHOICE') {
        if (!q.options.includes(answer)) {
          throw createError({
            statusCode: 400,
            statusMessage: `Invalid option for "${q.question}"`,
          })
        }
      }

      if (q.type === 'MULTIPLE_CHOICE') {
        const selected = answer.split(',').map(s => s.trim()).filter(Boolean)
        const invalid = selected.filter(v => !q.options.includes(v))
        if (invalid.length > 0) {
          throw createError({
            statusCode: 400,
            statusMessage: `Invalid options for "${q.question}": ${invalid.join(', ')}`,
          })
        }
      }
    }

    const existing = await applicationRepository.findByGroupAndEmail(group.id, input.email)

    if (existing) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Application failed',
      })
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

  /**
   * Updates an application's approval status after verifying the caller is the group organizer or admin.
   * Sends a localized status notification email to the applicant.
   * @param slug - The URL-friendly group identifier
   * @param applicationId - The application ID to update
   * @param status - New status: APPROVED or REJECTED
   * @param ctx - Authenticated user context with userId and isAdmin flag
   * @returns The updated application with id, name, email, status, and createdAt
   * @throws 404 if group or application not found, 403 if user lacks permission
   */
  async updateStatus(
    slug: string,
    applicationId: string,
    status: 'APPROVED' | 'REJECTED',
    ctx: { userId: string, isAdmin: boolean },
  ) {
    const group = await applicationRepository.findGroupWithOrganizer(slug)

    if (!group) {
      throw createError({ statusCode: 404, statusMessage: 'Group not found' })
    }

    if (group.organizer.userId !== ctx.userId && !ctx.isAdmin) {
      throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
    }

    const application = await applicationRepository.findByIdAndGroup(applicationId, group.id)

    if (!application) {
      throw createError({ statusCode: 404, statusMessage: 'Application not found' })
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
