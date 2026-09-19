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

    for (const answer of input.answers) {
      const question = questionsMap.get(answer.questionId)
      if (!question) {
        throw createError({
          statusCode: 400,
          statusMessage: `Question ${answer.questionId} not found for this group`,
        })
      }

      if (question.required && !answer.value.trim()) {
        throw createError({
          statusCode: 400,
          statusMessage: `Question "${question.question}" is required`,
        })
      }

      if (!answer.value.trim()) continue

      if (question.type === 'SINGLE_CHOICE') {
        if (!question.options.includes(answer.value)) {
          throw createError({
            statusCode: 400,
            statusMessage: `Invalid option for "${question.question}"`,
          })
        }
      }

      if (question.type === 'MULTIPLE_CHOICE') {
        const selected = answer.value.split(',').map(s => s.trim()).filter(Boolean)
        const invalid = selected.filter(v => !question.options.includes(v))
        if (invalid.length > 0) {
          throw createError({
            statusCode: 400,
            statusMessage: `Invalid options for "${question.question}": ${invalid.join(', ')}`,
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
