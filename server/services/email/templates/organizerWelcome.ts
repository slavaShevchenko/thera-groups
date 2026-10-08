import { button, greeting, paragraph } from '../renderer'
import type { TypedEmailTemplate } from '../types'

export const organizerWelcomeTemplate: TypedEmailTemplate<'organizer_welcome'> = {
  subjectKey: 'subject.organizerWelcome',
  preheaderKey: 'organizerWelcome.preheader',
  notificationType: 'ORGANIZER_WELCOME',

  render(data, ctx) {
    return [
      greeting(data.recipientName, ctx),
      paragraph(ctx.t('organizerWelcome.body1')),
      paragraph(ctx.t('organizerWelcome.body2')),
      button(ctx.absoluteUrl('/profile'), ctx.t('cta.viewProfile')),
    ].join('')
  },
}
