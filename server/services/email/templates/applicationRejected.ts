import { button, greeting, paragraph, reasonBlock } from '../renderer'
import type { TypedEmailTemplate } from '../types'

export const applicationRejectedTemplate: TypedEmailTemplate<'application_rejected'> = {
  subjectKey: 'subject.applicationRejected',
  preheaderKey: 'applicationRejected.preheader',
  notificationType: 'APPLICATION_REJECTED',

  render(data, ctx) {
    return [
      greeting(data.recipientName, ctx),
      paragraph(ctx.t('applicationRejected.body1', { groupTitle: data.groupTitle })),
      // Optional only for letters sent before the reason became mandatory; every rejection
      // decided since carries one, and it is the difference between "you did not fit" and
      // "the group filled up" for the applicant reading it.
      data.reason ? reasonBlock(ctx.t('common.reasonLabel', { reason: data.reason })) : '',
      paragraph(ctx.t('applicationRejected.body2')),
      button(ctx.absoluteUrl('/catalog'), ctx.t('cta.browseGroups')),
    ].join('')
  },
}
