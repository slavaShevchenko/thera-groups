import type { applySchema } from '../validators/application'
import type { z } from 'zod'
import { applicationRepository } from '../repositories/applicationRepository'
import { groupRepository } from '../repositories/groupRepository'
import { userRepository } from '../repositories/userRepository'
import { notifyApplicationReceived, notifyApplicationStatusChanged, notifyApplicationSubmitted, notifyApplicationWithdrawn } from '../utils/notifications'
import { NotFoundError, ForbiddenError, ValidationError, ConflictError, GroupEndedError, GroupFullError } from '../utils/domainErrors'
import { normalizeEmail } from '../utils/emailAddress'
import { prisma } from '../utils/prisma'
import { can } from '~~/shared/utils/permissions'
import { isPublicGroupStatus } from '~~/shared/constants/groupStatus'
import { isPastGroup } from '~~/shared/utils/groupVisibility'

type ApplyInput = z.infer<typeof applySchema>

export const applicationService = {
  async create(slug: string, input: ApplyInput, ctx: { userId?: string | null } = {}) {
    const group = await applicationRepository.findGroupWithQuestions(slug)

    // A group nobody may see does not exist as far as applying goes — same 404 as a bad
    // slug, so the endpoint cannot be used to probe for hidden groups.
    if (!group || !group.organizer || !isPublicGroupStatus(group.status)) {
      throw new NotFoundError('Group not found')
    }

    // Visible but closed, and each refusal gets its own code because the visitor's options
    // differ: a full group may free a seat when an approval is reversed, an ended one never
    // will, and the UI says so.
    if (group.status === 'FULL') {
      throw new GroupFullError()
    }

    if (group.status === 'COMPLETED') {
      throw new GroupEndedError()
    }

    // Nothing moves a row to COMPLETED automatically, so a past event still says PUBLISHED.
    // `isPastGroup` is the one definition of "ended" — `endsAt`, or `startsAt` when there is
    // no end date — and the badges, the apply button and the catalog ordering read it too.
    if (isPastGroup(group)) {
      throw new GroupEndedError()
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

  /**
   * Decides one application — approve, reject, or revert a rejection — and keeps the
   * group's seat state honest.
   *
   * Authorization is `can('application.manage')`, so the owner, a co-organizer and an admin
   * all act here — the same audience `application.viewForGroup` admits to the queue, which
   * is the point: a co-organizer who can read the list must be able to work it.
   *
   * The seat arithmetic runs inside one transaction that opens by locking the group row.
   * Without that lock two approvals racing on the last seat both counted the same number,
   * both passed the capacity check and both wrote, leaving the group over capacity with
   * nothing anywhere reporting an error. See `groupRepository.lockById`.
   */
  async updateStatus(
    slug: string,
    applicationId: string,
    status: 'APPROVED' | 'REJECTED' | 'PENDING',
    ctx: { userId: string, role: string },
    rejectionReason?: string,
  ) {
    const group = await applicationRepository.findGroupForStatusUpdate(slug)

    if (!group || !group.organizer) {
      throw new NotFoundError('Group not found')
    }

    const allowed = can(
      'application.manage',
      { id: ctx.userId, role: ctx.role },
      {
        organizerUserId: group.organizer.userId,
        coOrganizerUserIds: group.coOrganizers.map(co => co.userId),
      },
    )

    if (!allowed) {
      throw new ForbiddenError()
    }

    const updated = await prisma.$transaction(async (tx) => {
      const locked = await groupRepository.lockById(group.id, tx)

      if (!locked) {
        throw new NotFoundError('Group not found')
      }

      // Read under the lock rather than trusted from before it: a concurrent approval may
      // already have moved the group to FULL, and both transitions below depend on which
      // status is current, not on which one this request started with.
      const { status: groupStatus, capacity } = locked

      const application = await applicationRepository.findByIdAndGroup(applicationId, group.id, tx)

      if (!application) {
        throw new NotFoundError('Application not found')
      }

      // Rejecting without saying why left the applicant with a bare "not approved" and no
      // way to tell a full group from a request that did not fit. The rule
      // `organizerService.moderateProfile` already applies to a profile rejection.
      if (status === 'REJECTED' && !rejectionReason?.trim()) {
        throw new ValidationError('Rejection reason is required')
      }

      // Only a rejection is reversible. An APPROVED application holds a seat, so pulling it
      // back to PENDING would change the group's occupancy after the applicant was already
      // told they are in — undoing that goes through REJECTED, which frees the seat in the
      // branch below.
      if (status === 'PENDING' && application.status !== 'REJECTED') {
        throw new ConflictError('Only a rejected application can be reverted to pending')
      }

      if (status === 'APPROVED' && capacity !== null) {
        const approvedCount = await applicationRepository.countApproved(group.id, tx)
        if (approvedCount >= capacity) {
          // Same code the public apply path refuses with, so one message covers both.
          throw new GroupFullError()
        }
      }

      // Cleared on every non-rejection, so a reverted or approved application never keeps
      // explaining a decision that is no longer in force.
      const reason = status === 'REJECTED' ? rejectionReason?.trim() ?? null : null

      const result = await applicationRepository.updateWithSelect(
        applicationId,
        { status, rejectionReason: reason },
        tx,
      )

      if (status === 'APPROVED' && capacity !== null) {
        const newApprovedCount = await applicationRepository.countApproved(group.id, tx)
        if (newApprovedCount >= capacity && groupStatus === 'PUBLISHED') {
          await groupRepository.update(group.id, { status: 'FULL' }, tx)
        }
      }

      // The way back out of FULL, and the only one: rejecting an approved applicant frees
      // a seat. Without it a full group stayed full forever — no later approval could
      // recount, because the capacity check above refuses to approve past the limit — and
      // the group kept showing "no places" with places actually free.
      //
      // A revert needs no counterpart: `countApproved` counts APPROVED rows only, and
      // neither REJECTED nor PENDING is one, so REJECTED → PENDING moves no seat.
      if (status === 'REJECTED' && groupStatus === 'FULL' && capacity !== null) {
        const approvedCount = await applicationRepository.countApproved(group.id, tx)
        if (approvedCount < capacity) {
          await groupRepository.update(group.id, { status: 'PUBLISHED' }, tx)
        }
      }

      return result
    })

    // A revert is an internal correction, not a new decision, and nothing in the
    // NotificationType enum or the email registry describes it — so it stays silent rather
    // than re-using the rejection letter, which would tell the applicant the opposite of
    // what just happened. They hear from us again when a real decision lands.
    if (status !== 'PENDING') {
      await notifyApplicationStatusChanged(
        updated.email,
        group.title,
        group.slug,
        status,
        updated.rejectionReason ?? undefined,
      )
    }

    // Re-read rather than inferred: the transaction may have moved the group between
    // PUBLISHED and FULL, and the managing page shows that state next to the seat tally.
    const seats = await applicationRepository.findGroupSeats(group.id)

    return { application: updated, group: seats }
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
      // A guest application stores `userId = NULL`, so the address is the only link to the
      // account that later registered with it. Normalized on both sides: `User.email` is a
      // byte-for-byte unique lookup and a row written before normalization existed may
      // still hold a differently-cased copy of the same address.
      const applicant = await userRepository.findIdByEmail(normalizeEmail(application.email))

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
