import { button, greeting, paragraph } from '../renderer'
import type { TypedEmailTemplate } from '../types'

export const applicationSubmittedTemplate: TypedEmailTemplate<'application_submitted'> = {
  subjectKey: 'subject.applicationSubmitted',
  preheaderKey: 'applicationSubmitted.preheader',
  notificationType: 'APPLICATION_SUBMITTED',

  render(data, ctx) {
    return [
      greeting(data.recipientName, ctx),
      paragraph(ctx.t('applicationSubmitted.body1', { groupTitle: data.groupTitle })),
      paragraph(ctx.t('applicationSubmitted.body2')),
      button(ctx.absoluteUrl(`/groups/${data.groupSlug}`), ctx.t('cta.viewGroup')),
    ].join('')
  },
}
