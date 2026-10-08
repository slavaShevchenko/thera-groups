import { button, greeting, paragraph } from '../renderer'
import type { TypedEmailTemplate } from '../types'

export const groupSubmittedTemplate: TypedEmailTemplate<'group_submitted'> = {
  subjectKey: 'subject.groupSubmitted',
  preheaderKey: 'groupSubmitted.preheader',
  notificationType: 'GROUP_SUBMITTED',

  render(data, ctx) {
    return [
      greeting(data.recipientName, ctx),
      paragraph(ctx.t('groupSubmitted.body1', { groupTitle: data.groupTitle })),
      paragraph(ctx.t('groupSubmitted.body2')),
      button(ctx.absoluteUrl(`/groups/${data.groupSlug}`), ctx.t('cta.viewGroup')),
    ].join('')
  },
}
