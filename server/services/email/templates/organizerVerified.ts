import { button, greeting, paragraph } from '../renderer'
import type { TypedEmailTemplate } from '../types'

export const organizerVerifiedTemplate: TypedEmailTemplate<'organizer_verified'> = {
  subjectKey: 'subject.organizerVerified',
  preheaderKey: 'organizerVerified.preheader',
  notificationType: 'ORGANIZER_APPROVED',

  render(data, ctx) {
    return [
      greeting(data.recipientName, ctx),
      paragraph(ctx.t('organizerVerified.body1', { organizerName: data.organizerName })),
      paragraph(ctx.t('organizerVerified.body2')),
      button(ctx.absoluteUrl('/groups/new'), ctx.t('cta.createGroup')),
    ].join('')
  },
}
