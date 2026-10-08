import type { NotificationType } from '@prisma/client'
import { applicationApprovedTemplate } from './templates/applicationApproved'
import { applicationReceivedTemplate } from './templates/applicationReceived'
import { applicationRejectedTemplate } from './templates/applicationRejected'
import { applicationSubmittedTemplate } from './templates/applicationSubmitted'
import { applicationWithdrawnTemplate } from './templates/applicationWithdrawn'
import { groupAutoRevertTemplate } from './templates/groupAutoRevert'
import { groupPendingReviewTemplate } from './templates/groupPendingReview'
import { groupPublishedTemplate } from './templates/groupPublished'
import { groupRejectedTemplate } from './templates/groupRejected'
import { groupSubmittedTemplate } from './templates/groupSubmitted'
import { organizerPendingReviewTemplate } from './templates/organizerPendingReview'
import { organizerRejectedTemplate } from './templates/organizerRejected'
import { organizerVerifiedTemplate } from './templates/organizerVerified'
import { organizerWelcomeTemplate } from './templates/organizerWelcome'
import type { EmailTemplate, EmailTemplateEntry, TypedEmailTemplate } from './types'

/**
 * Widens a per-template declaration to the registry shape. The single cast lives here so
 * each template file keeps `data` typed to its own payload instead of the union of all
 * fourteen, which is what catches a wrong field at the call site.
 */
function entry<T extends EmailTemplate>(template: TypedEmailTemplate<T>): EmailTemplateEntry {
  return template as unknown as EmailTemplateEntry
}

export const emailRegistry: Record<EmailTemplate, EmailTemplateEntry> = {
  application_received: entry(applicationReceivedTemplate),
  application_submitted: entry(applicationSubmittedTemplate),
  application_approved: entry(applicationApprovedTemplate),
  application_rejected: entry(applicationRejectedTemplate),
  application_withdrawn: entry(applicationWithdrawnTemplate),
  group_published: entry(groupPublishedTemplate),
  group_rejected: entry(groupRejectedTemplate),
  group_pending_review: entry(groupPendingReviewTemplate),
  group_submitted: entry(groupSubmittedTemplate),
  group_auto_revert: entry(groupAutoRevertTemplate),
  organizer_pending_review: entry(organizerPendingReviewTemplate),
  organizer_verified: entry(organizerVerifiedTemplate),
  organizer_rejected: entry(organizerRejectedTemplate),
  organizer_welcome: entry(organizerWelcomeTemplate),
}

/**
 * NotificationType values that deliberately have no email template, with the reason.
 *
 * `tests/server/email/registry.test.ts` fails when a NotificationType is neither mapped
 * below nor listed here, so adding a type forces an explicit decision.
 */
export const notificationTypesWithoutEmail: Partial<Record<NotificationType, string>> = {
  // No producer exists: a "starting soon" reminder needs a scheduler, and the project has
  // none (no cron, no queue). Adding the template now would be unreachable code.
  GROUP_STARTING: 'No scheduler produces this notification yet — template intentionally omitted.',
}

/** Reverse lookup used by `notifications.ts` to keep its call sites template-agnostic. */
export function templateForNotificationType(
  type: NotificationType,
): EmailTemplate | null {
  const match = (Object.keys(emailRegistry) as EmailTemplate[])
    .find(template => emailRegistry[template].notificationType === type)

  return match ?? null
}
