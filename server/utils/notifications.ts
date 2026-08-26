import { prisma } from './prisma'
import type { NotificationType } from '@prisma/client'

export async function createNotification(
  userId: string,
  type: NotificationType,
  entityType: string,
  entityId: string,
  title: string,
  message: string,
) {
  return prisma.notification.create({
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

  const resendKey = process.env.RESEND_API_KEY
  if (!resendKey) {
    await prisma.emailEvent.update({
      where: { id: emailEvent.id },
      data: { error: 'RESEND_API_KEY not configured' },
    })
    return { sent: false, reason: 'no_api_key' }
  }

  try {
    const { Resend } = await import('resend')
    const resend = new Resend(resendKey)

    const result = await resend.emails.send({
      from: process.env.EMAIL_FROM || 'noreply@theragroups.com',
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
) {
  await createNotification(
    organizerUserId,
    'APPLICATION_RECEIVED',
    'group',
    groupSlug,
    'Нова заявка',
    `${applicantName} подав заявку на групу «${groupTitle}»`,
  )
}

export async function notifyApplicationStatusChanged(
  applicantEmail: string,
  groupTitle: string,
  groupSlug: string,
  newStatus: string,
) {
  const statusLabel = newStatus === 'APPROVED' ? 'схвалено' : 'відхилено'
  const type = newStatus === 'APPROVED' ? 'APPLICATION_APPROVED' : 'APPLICATION_REJECTED'

  await createEmailEvent(
    applicantEmail,
    type,
    groupSlug,
    `Ваша заявка на групу «${groupTitle}» ${statusLabel}`,
    `<p>Ваша заявка на групу <strong>«${groupTitle}»</strong> була ${statusLabel}.</p>`,
  )
}

export async function notifyGroupPublished(
  organizerUserId: string,
  groupTitle: string,
  groupSlug: string,
) {
  await createNotification(
    organizerUserId,
    'GROUP_APPROVED',
    'group',
    groupSlug,
    'Групу опубліковано',
    `Ваша група «${groupTitle}» опублікована і доступна відвідувачам`,
  )
}

export async function notifyGroupRejected(
  organizerUserId: string,
  groupTitle: string,
  groupSlug: string,
  rejectionReason: string,
) {
  await createNotification(
    organizerUserId,
    'GROUP_REJECTED',
    'group',
    groupSlug,
    'Групу відхилено',
    `Ваша група «${groupTitle}» відхилена. Причина: ${rejectionReason}`,
  )
}
