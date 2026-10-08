import type { NotificationType } from '@prisma/client'
import { sendEmailFireAndForget } from '../services/email'
import type { EmailTemplate, SendEmailOptions, TemplateDataMap } from '../services/email/types'
import { t, tEmail } from '../i18n'
import { prisma } from './prisma'
import type { PrismaClientOrTx } from '../repositories/types'

type Locale = 'ua' | 'en'

function resolveLocale(value: string | null | undefined): Locale {
  return value === 'en' ? 'en' : 'ua'
}

/**
 * Localized label for a critical group field, named in the auto-revert email. Falls back to
 * the raw field name so an unmapped key reads as camelCase instead of as an i18n key.
 */
function fieldLabel(field: string, locale: Locale): string {
  const key = `field.${field}`
  const label = tEmail(key, locale)

  return label === key ? field : label
}

export async function createNotification(
  userId: string,
  type: NotificationType,
  entityType: string,
  entityId: string,
  title: string,
  message: string,
  tx: PrismaClientOrTx = prisma,
) {
  return (tx as PrismaClientOrTx).notification.create({
    data: { userId, type, entityType, entityId, title, message },
  })
}

interface EmailRecipient {
  email: string
  name?: string
  locale: Locale
}

/**
 * Contact details for a user-bound recipient. `null` when the user no longer exists, in
 * which case the caller keeps the in-app notification and simply sends no email.
 */
async function findEmailRecipient(userId: string): Promise<EmailRecipient | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      email: true,
      preferredLocale: true,
      organizerProfile: { select: { firstName: true, lastName: true } },
    },
  })

  if (!user) return null

  const profile = user.organizerProfile
  const name = profile ? `${profile.firstName} ${profile.lastName}`.trim() : ''

  return { email: user.email, name: name || undefined, locale: resolveLocale(user.preferredLocale) }
}

export async function notifyApplicationReceived(
  organizerUserId: string,
  applicantName: string,
  groupTitle: string,
  groupSlug: string,
  locale: string = 'ua',
) {
  const { subject, body } = t('application.new', resolveLocale(locale), {
    applicantName,
    groupTitle,
  })

  await createNotification(
    organizerUserId,
    'APPLICATION_RECEIVED',
    'group',
    groupSlug,
    subject,
    body,
  )

  const recipient = await findEmailRecipient(organizerUserId)

  if (recipient) {
    sendEmailFireAndForget({
      to: recipient.email,
      template: 'application_received',
      // The recipient's own preference, not the caller's `locale` argument: both name the
      // organizer today, but the profile stays correct if a co-organizer is added later.
      locale: recipient.locale,
      data: { recipientName: recipient.name, applicantName, groupTitle, groupSlug },
      entityId: groupSlug,
    })
  }
}

/**
 * Acknowledges receipt to the applicant. The other half of `notifyApplicationReceived`:
 * one message tells the organizer an application arrived, this one tells the applicant it
 * did, which is what stops "did my application go through?" support requests.
 *
 * Applicants are usually unregistered visitors, so only the address and the name they typed
 * are known: the greeting uses that name and the in-app half is skipped without an account.
 */
export async function notifyApplicationSubmitted(
  applicantEmail: string,
  applicantName: string,
  groupTitle: string,
  groupSlug: string,
  groupId?: string,
) {
  const applicant = await prisma.user.findUnique({
    where: { email: applicantEmail },
    select: { id: true, preferredLocale: true },
  })
  const locale = resolveLocale(applicant?.preferredLocale)

  const { subject, body } = t('application.submitted', locale, { groupTitle })

  sendEmailFireAndForget({
    to: applicantEmail,
    template: 'application_submitted',
    locale,
    data: { recipientName: applicantName, groupTitle, groupSlug },
    entityId: groupSlug,
  })

  if (applicant?.id) {
    await createNotification(
      applicant.id,
      'APPLICATION_SUBMITTED',
      'group',
      groupId ?? groupSlug,
      subject,
      body,
    )
  }
}

export async function notifyApplicationStatusChanged(
  applicantEmail: string,
  groupTitle: string,
  groupSlug: string,
  newStatus: string,
  groupId?: string,
) {
  const applicant = await prisma.user.findUnique({
    where: { email: applicantEmail },
    select: { id: true, preferredLocale: true },
  })
  const locale = resolveLocale(applicant?.preferredLocale)

  const key = newStatus === 'APPROVED' ? 'application.approved' : 'application.rejected'
  const type: NotificationType = newStatus === 'APPROVED' ? 'APPLICATION_APPROVED' : 'APPLICATION_REJECTED'

  const { subject, body } = t(key, locale, { groupTitle })

  // Applicants are usually unregistered visitors, so only their email address is known
  // and the greeting stays generic.
  sendEmailFireAndForget({
    to: applicantEmail,
    template: newStatus === 'APPROVED' ? 'application_approved' : 'application_rejected',
    locale,
    data: { groupTitle, groupSlug },
    entityId: groupSlug,
  })

  if (applicant?.id) {
    await createNotification(
      applicant.id,
      type,
      'group',
      groupId ?? groupSlug,
      subject,
      body,
    )
  }
}

export async function notifyApplicationWithdrawn(
  organizerUserId: string,
  applicantName: string,
  groupTitle: string,
  groupSlug: string,
  applicationId: string,
) {
  const recipient = await findEmailRecipient(organizerUserId)
  const locale = recipient?.locale ?? 'ua'

  const { subject, body } = t('application.withdrawn', locale, {
    applicantName,
    groupTitle,
  })

  await createNotification(
    organizerUserId,
    'APPLICATION_WITHDRAWN',
    'application',
    applicationId,
    subject,
    body,
  )

  if (recipient) {
    sendEmailFireAndForget({
      to: recipient.email,
      template: 'application_withdrawn',
      locale,
      data: { recipientName: recipient.name, applicantName, groupTitle, groupSlug },
      entityId: groupSlug,
    })
  }
}

export async function notifyGroupPublished(
  organizerUserId: string,
  groupTitle: string,
  groupSlug: string,
  locale: string = 'ua',
) {
  const { subject, body } = t('group.published', resolveLocale(locale), {
    title: groupTitle,
  })

  await createNotification(
    organizerUserId,
    'GROUP_APPROVED',
    'group',
    groupSlug,
    subject,
    body,
  )

  const recipient = await findEmailRecipient(organizerUserId)

  if (recipient) {
    sendEmailFireAndForget({
      to: recipient.email,
      template: 'group_published',
      locale: recipient.locale,
      data: { recipientName: recipient.name, groupTitle, groupSlug },
      entityId: groupSlug,
    })
  }
}

export async function notifyGroupRejected(
  organizerUserId: string,
  groupTitle: string,
  groupSlug: string,
  rejectionReason: string,
  locale: string = 'ua',
) {
  const { subject, body } = t('group.rejected', resolveLocale(locale), {
    title: groupTitle,
    reason: rejectionReason,
  })

  await createNotification(
    organizerUserId,
    'GROUP_REJECTED',
    'group',
    groupSlug,
    subject,
    body,
  )

  const recipient = await findEmailRecipient(organizerUserId)

  if (recipient) {
    sendEmailFireAndForget({
      to: recipient.email,
      template: 'group_rejected',
      locale: recipient.locale,
      data: { recipientName: recipient.name, groupTitle, groupSlug, reason: rejectionReason },
      entityId: groupSlug,
    })
  }
}

/**
 * Acknowledges a moderation submission to the group owner. The owner-facing counterpart of
 * `notifyAdminsGroupPendingReview`: both fire on the same transition, one to each side.
 */
export async function notifyGroupSubmitted(
  organizerUserId: string,
  groupTitle: string,
  groupSlug: string,
) {
  const recipient = await findEmailRecipient(organizerUserId)
  const locale = recipient?.locale ?? 'ua'

  const { subject, body } = t('group.submitted', locale, { title: groupTitle })

  await createNotification(
    organizerUserId,
    'GROUP_SUBMITTED',
    'group',
    groupSlug,
    subject,
    body,
  )

  if (recipient) {
    sendEmailFireAndForget({
      to: recipient.email,
      template: 'group_submitted',
      locale: recipient.locale,
      data: { recipientName: recipient.name, groupTitle, groupSlug },
      entityId: groupSlug,
    })
  }
}

/**
 * Tells the owner why a PUBLISHED group fell back to moderation. Distinct from
 * `notifyGroupSubmitted` even though the same transition fires it: an edit that undid a
 * publication needs the reason, a deliberate submission does not.
 *
 * `changedFields` carries update-payload field names and may be empty, when the request
 * re-sent critical fields without changing any value; the email then omits the field list.
 */
export async function notifyGroupAutoReverted(
  organizerUserId: string,
  groupTitle: string,
  groupSlug: string,
  changedFields: string[],
) {
  const recipient = await findEmailRecipient(organizerUserId)
  const locale = recipient?.locale ?? 'ua'
  const fields = changedFields.map(field => fieldLabel(field, locale)).join(', ')

  const { subject, body } = t('group.autoRevert', locale, { title: groupTitle })

  await createNotification(
    organizerUserId,
    'GROUP_AUTO_REVERT',
    'group',
    groupSlug,
    subject,
    body,
  )

  if (recipient) {
    sendEmailFireAndForget({
      to: recipient.email,
      template: 'group_auto_revert',
      locale: recipient.locale,
      data: { recipientName: recipient.name, groupTitle, groupSlug, changedFields: fields },
      entityId: groupSlug,
    })
  }
}

/**
 * Welcomes a new organizer and sets the expectation that verification is still pending —
 * without it the sign-up looks like it went nowhere until a moderator acts.
 *
 * Fires inside registration, before any lookup would be meaningful, so the address and
 * locale come from the request rather than from a second read of the row just written.
 */
export async function notifyOrganizerWelcome(
  userId: string,
  email: string,
  firstName: string,
  profileSlug: string,
  locale: string = 'ua',
) {
  const resolved = resolveLocale(locale)

  const { subject, body } = t('organizer.welcome', resolved)

  await createNotification(
    userId,
    'ORGANIZER_WELCOME',
    'organizerProfile',
    profileSlug,
    subject,
    body,
  )

  sendEmailFireAndForget({
    to: email,
    template: 'organizer_welcome',
    locale: resolved,
    data: { recipientName: firstName },
    entityId: profileSlug,
  })
}

/**
 * Builds the email half of an admin notification. `to` and `locale` come from the admin
 * row, so the factory only supplies the template and its payload.
 */
type AdminEmailFactory<T extends EmailTemplate>
  = (_recipientName: string | undefined) => Omit<SendEmailOptions<T>, 'to' | 'locale'>

async function notifyAllAdmins<T extends EmailTemplate>(
  type: NotificationType,
  entityType: string,
  entityId: string,
  translationKey: string,
  params: Record<string, string>,
  email: AdminEmailFactory<T>,
  tx: PrismaClientOrTx = prisma,
) {
  const db = tx as PrismaClientOrTx
  const admins = await db.user.findMany({
    where: { role: 'ADMIN' },
    select: {
      id: true,
      email: true,
      preferredLocale: true,
      organizerProfile: { select: { firstName: true, lastName: true } },
    },
  })

  await Promise.all(
    admins.map((admin) => {
      const { subject, body } = t(translationKey, resolveLocale(admin.preferredLocale), params)
      return createNotification(admin.id, type, entityType, entityId, subject, body, tx)
    }),
  )

  // Fire-and-forget and outside `tx` on purpose: a provider round-trip can take tens of
  // seconds across retries, and holding transaction locks that long would stall writers.
  for (const admin of admins) {
    const profile = admin.organizerProfile
    const name = profile ? `${profile.firstName} ${profile.lastName}`.trim() : ''

    sendEmailFireAndForget({
      to: admin.email,
      locale: resolveLocale(admin.preferredLocale),
      ...email(name || undefined),
      entityId,
    } as SendEmailOptions<T>)
  }
}

export async function notifyAdminsGroupPendingReview(groupTitle: string, groupSlug: string, tx: PrismaClientOrTx = prisma) {
  await notifyAllAdmins(
    'GROUP_PENDING_REVIEW',
    'group',
    groupSlug,
    'admin.group.pending',
    { title: groupTitle },
    recipientName => ({
      template: 'group_pending_review',
      data: { recipientName, groupTitle } satisfies TemplateDataMap['group_pending_review'],
    }),
    tx,
  )
}

export async function notifyAdminsOrganizerPendingReview(organizerName: string, profileSlug: string) {
  await notifyAllAdmins(
    'ORGANIZER_PENDING_REVIEW',
    'organizerProfile',
    profileSlug,
    'admin.organizer.pending',
    { name: organizerName },
    recipientName => ({
      template: 'organizer_pending_review',
      data: { recipientName, organizerName } satisfies TemplateDataMap['organizer_pending_review'],
    }),
  )
}
