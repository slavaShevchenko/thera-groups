import type { applySchema } from '../validators/application'
import type { z } from 'zod'
import { notifyApplicationReceived, notifyApplicationStatusChanged } from '../utils/notifications'

type ApplyInput = z.infer<typeof applySchema>

export const applicationService = {
  /**
   * Submit an application to a published group.
   * Validates answers against group questions and prevents duplicates.
   */
  async create(slug: string, input: ApplyInput) {
    const group = await prisma.group.findUnique({
      where: { slug },
      select: {
        id: true,
        status: true,
        questions: {
          select: {
            id: true,
            question: true,
            type: true,
            required: true,
            options: true,
          },
        },
      },
    })

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

    const existing = await prisma.application.findFirst({
      where: {
        groupId: group.id,
        email: input.email,
      },
    })

    if (existing) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Application failed',
      })
    }

    const application = await prisma.application.create({
      data: {
        groupId: group.id,
        name: input.name,
        email: input.email,
        phone: input.phone,
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

    const fullGroup = await prisma.group.findUnique({
      where: { id: group.id },
      include: {
        organizer: {
          select: {
            userId: true,
            user: { select: { preferredLocale: true } },
          },
        },
      },
    })

    if (fullGroup) {
      await notifyApplicationReceived(
        fullGroup.organizer.userId,
        input.name,
        fullGroup.title,
        fullGroup.slug,
        fullGroup.organizer.user.preferredLocale,
      )
    }

    return { application }
  },

  /**
   * Approve or reject an application. Sends notification to the applicant.
   */
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
        organizer: { select: { userId: true } },
      },
    })

    if (!group) {
      throw createError({ statusCode: 404, statusMessage: 'Group not found' })
    }

    if (group.organizer.userId !== ctx.userId && !ctx.isAdmin) {
      throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
    }

    const application = await prisma.application.findFirst({
      where: {
        id: applicationId,
        groupId: group.id,
      },
    })

    if (!application) {
      throw createError({ statusCode: 404, statusMessage: 'Application not found' })
    }

    const updated = await prisma.application.update({
      where: { id: applicationId },
      data: { status },
      select: {
        id: true,
        name: true,
        email: true,
        status: true,
        createdAt: true,
      },
    })

    const groupData = await prisma.group.findUnique({
      where: { id: group.id },
      select: { title: true, slug: true },
    })

    if (groupData) {
      await notifyApplicationStatusChanged(
        updated.email,
        groupData.title,
        groupData.slug,
        status,
      )
    }

    return { application: updated }
  },
}
