import { button, greeting, paragraph } from '../renderer'
import type { TypedEmailTemplate } from '../types'

export const applicationRejectedTemplate: TypedEmailTemplate<'application_rejected'> = {
  subjectKey: 'subject.applicationRejected',
  preheaderKey: 'applicationRejected.preheader',
  notificationType: 'APPLICATION_REJECTED',

  render(data, ctx) {
    return [
      greeting(data.recipientName, ctx),
      paragraph(ctx.t('applicationRejected.body1', { groupTitle: data.groupTitle })),
      paragraph(ctx.t('applicationRejected.body2')),
      button(ctx.absoluteUrl('/catalog'), ctx.t('cta.browseGroups')),
    ].join('')
  },
}
