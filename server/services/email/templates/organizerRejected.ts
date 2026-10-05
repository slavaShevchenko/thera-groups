import { button, greeting, paragraph, reasonBlock } from '../renderer'
import type { TypedEmailTemplate } from '../types'

export const organizerRejectedTemplate: TypedEmailTemplate<'organizer_rejected'> = {
  subjectKey: 'subject.organizerRejected',
  preheaderKey: 'organizerRejected.preheader',
  notificationType: 'ORGANIZER_REJECTED',

  render(data, ctx) {
    return [
      greeting(data.recipientName, ctx),
      paragraph(ctx.t('organizerRejected.body1', { organizerName: data.organizerName })),
      reasonBlock(ctx.t('common.reasonLabel', { reason: data.reason })),
      paragraph(ctx.t('organizerRejected.body2')),
      button(ctx.absoluteUrl('/profile/edit'), ctx.t('cta.viewProfile')),
    ].join('')
  },
}
