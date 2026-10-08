import type { applySchema } from '../validators/application'
import type { z } from 'zod'
import { applicationRepository } from '../repositories/applicationRepository'
import { notifyApplicationReceived, notifyApplicationStatusChanged, notifyApplicationSubmitted, notifyApplicationWithdrawn } from '../utils/notifications'
import { NotFoundError, ForbiddenError, ValidationError, ConflictError } from '../utils/domainErrors'
import { prisma } from '../utils/prisma'

type ApplyInput = z.infer<typeof applySchema>

export const applicationService = {
  async create(slug: string, input: ApplyInput, ctx: { userId?: string | null } = {}) {
    const group = await applicationRepository.findGroupWithQuestions(slug)

    if (!group || group.status !== 'PUBLISHED' || !group.organizer) {
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

    try {
      const application = await prisma.$transaction(async (tx) => {
        const duplicateWhere: Record<string, unknown>[] = [
          { groupId: group.id, email: input.email },
        ]
        if (ctx.userId) {
          duplicateWhere.push({ groupId: group.id, userId: ctx.userId })
        }

        const existing = await tx.application.findFirst({
          where: { OR: duplicateWhere },
        })

        if (existing) {
          throw new ConflictError('Already applied')
        }

        return tx.application.create({
          data: {
            groupId: group.id,
            ...(ctx.userId && { userId: ctx.userId }),
            name: input.name,
            email: input.email,
            phone: input.phone,
            message: input.message,
            status: 'PENDING',
            answers: {
              create: input.answers
                .filter(a => a.value.trim())
                .map(a => ({
                  questionId: a.questionId,
                  value: a.value,
                })),
            },
          },
          select: {
            id: true,
            status: true,
            createdAt: true,
          },
        })
      })

      await notifyApplicationReceived(
        group.organizer.userId,
        input.name,
        group.title,
        group.slug,
        group.organizer.user.preferredLocale,
      )

      // Two messages for one application, one per side: the organizer learns it arrived,
      // the applicant learns it was received. Neither may cost the application itself, so
      // both run after commit and `sendEmail` never throws into this caller.
      await notifyApplicationSubmitted(
        input.email,
        input.name,
        group.title,
        group.slug,
        group.id,
      )

      return { application }
    }
    catch (error) {
      if (error instanceof ConflictError) throw error
      if (error && typeof error === 'object' && 'code' in error && (error as { code: string }).code === 'P2002') {
        throw new ConflictError('Already applied')
      }
      throw error
    }
  },

  async updateStatus(
    slug: string,
    applicationId: string,
    status: 'APPROVED' | 'REJECTED',
    ctx: { userId: string, isAdmin: boolean },
  ) {
    const group = await prisma.group.findUnique({
      where: { slug },
      select: {
        id: true,
        title: true,
        slug: true,
        capacity: true,
        status: true,
        organizer: { select: { userId: true } },
      },
    })

    if (!group || !group.organizer) {
      throw new NotFoundError('Group not found')
    }

    if (group.organizer.userId !== ctx.userId && !ctx.isAdmin) {
      throw new ForbiddenError()
    }

    const application = await applicationRepository.findByIdAndGroup(applicationId, group.id)

    if (!application) {
      throw new NotFoundError('Application not found')
    }

    const updated = await prisma.$transaction(async (tx) => {
      if (status === 'APPROVED' && group.capacity !== null) {
        const approvedCount = await tx.application.count({
          where: { groupId: group.id, status: 'APPROVED' },
        })
        if (approvedCount >= group.capacity) {
          throw new ConflictError('Group is full')
        }
      }

      const result = await applicationRepository.updateWithSelect(
        applicationId,
        { status },
      )

      if (status === 'APPROVED' && group.capacity !== null) {
        const newApprovedCount = await tx.application.count({
          where: { groupId: group.id, status: 'APPROVED' },
        })
        if (newApprovedCount >= group.capacity && group.status === 'PUBLISHED') {
          await tx.group.update({
            where: { id: group.id },
            data: { status: 'FULL' },
          })
        }
      }

      return result
    })

    await notifyApplicationStatusChanged(
      updated.email,
      group.title,
      group.slug,
      status,
      group.id,
    )

    return { application: updated }
  },

  async withdraw(
    applicationId: string,
    userId: string,
  ) {
    const application = await applicationRepository.findById(applicationId)

    if (!application) {
      throw new NotFoundError('Application not found')
    }

    const isOwner = application.userId === userId

    if (!isOwner) {
      const applicant = await prisma.user.findUnique({
        where: { email: application.email },
        select: { id: true },
      })

      if (!applicant || applicant.id !== userId) {
        throw new ForbiddenError()
      }
    }

    if (application.status !== 'PENDING') {
      throw new ConflictError('Can only withdraw pending applications')
    }

    const updated = await applicationRepository.updateWithSelect(
      applicationId,
      { status: 'WITHDRAWN' },
    )

    const group = await applicationRepository.findGroupWithOrganizer(application.group.slug)
    if (group && group.organizer) {
      await notifyApplicationWithdrawn(
        group.organizer.userId,
        updated.name,
        group.title,
        group.slug,
        applicationId,
      )
    }

    return { application: updated }
  },
}
