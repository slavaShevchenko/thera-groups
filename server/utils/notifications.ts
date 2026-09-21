import { prisma } from './prisma'
import { t } from '../i18n'
import type { NotificationType } from '@prisma/client'
import type { PrismaClientOrTx } from '../repositories/types'

type Locale = 'ua' | 'en'

function resolveLocale(value: string | null | undefined): Locale {
  return value === 'en' ? 'en' : 'ua'
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

export async function createEmailEvent(
  recipient: string,
  type: string,
  entityId: string | null,
  subject: string,
  body: string,
) {
  const emailEvent = await prisma.emailEvent.create({
    data: { recipient, type, entityId, status: 'PENDING' },
  })

  const { resendApiKey, emailFrom } = useServerConfig()
  if (!resendApiKey) {
    await prisma.emailEvent.update({
      where: { id: emailEvent.id },
      data: { error: 'RESEND_API_KEY not configured' },
    })
    return { sent: false, reason: 'no_api_key' }
  }

  try {
    const { Resend } = await import('resend')
    const resend = new Resend(resendApiKey)

    const result = await resend.emails.send({
      from: emailFrom,
      to: recipient,
      subject,
      html: body,
    })

    await prisma.emailEvent.update({
      where: { id: emailEvent.id },
      data: {
        status: 'SENT',
        sentAt: new Date(),
        providerId: result.data?.id ?? null,
      },
    })

    return { sent: true, id: result.data?.id }
  }
  catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error'
    await prisma.emailEvent.update({
      where: { id: emailEvent.id },
      data: { status: 'FAILED', error: errorMsg },
    })
    return { sent: false, reason: errorMsg }
  }
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
}

export async function notifyApplicationStatusChanged(
  applicantEmail: string,
  groupTitle: string,
  groupSlug: string,
  newStatus: string,
) {
  const applicant = await prisma.user.findUnique({
    where: { email: applicantEmail },
    select: { preferredLocale: true },
  })
  const locale = resolveLocale(applicant?.preferredLocale)

  const key = newStatus === 'APPROVED' ? 'application.approved' : 'application.rejected'
  const type: NotificationType = newStatus === 'APPROVED' ? 'APPLICATION_APPROVED' : 'APPLICATION_REJECTED'

  const { subject, body } = t(key, locale, { groupTitle })

  await createEmailEvent(
    applicantEmail,
    type,
    groupSlug,
    subject,
    `<p>${body}</p>`,
  )
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
}

async function notifyAllAdmins(
  type: NotificationType,
  entityType: string,
  entityId: string,
  translationKey: string,
  params: Record<string, string>,
  tx: PrismaClientOrTx = prisma,
) {
  const db = tx as PrismaClientOrTx
  const admins = await db.user.findMany({
    where: { role: 'ADMIN' },
    select: { id: true, preferredLocale: true },
  })

  await Promise.all(
    admins.map((admin) => {
      const { subject, body } = t(translationKey, resolveLocale(admin.preferredLocale), params)
      return createNotification(admin.id, type, entityType, entityId, subject, body, tx)
    }),
  )
}

export async function notifyAdminsGroupPendingReview(groupTitle: string, groupSlug: string, tx: PrismaClientOrTx = prisma) {
  await notifyAllAdmins(
    'GROUP_PENDING_REVIEW',
    'group',
    groupSlug,
    'admin.group.pending',
    { title: groupTitle },
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
  )
}
