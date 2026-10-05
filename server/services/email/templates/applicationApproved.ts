import { button, greeting, paragraph } from '../renderer'
import type { TypedEmailTemplate } from '../types'

export const applicationApprovedTemplate: TypedEmailTemplate<'application_approved'> = {
  subjectKey: 'subject.applicationApproved',
  preheaderKey: 'applicationApproved.preheader',
  notificationType: 'APPLICATION_APPROVED',

  render(data, ctx) {
    return [
      greeting(data.recipientName, ctx),
      paragraph(ctx.t('applicationApproved.body1', { groupTitle: data.groupTitle })),
      paragraph(ctx.t('applicationApproved.body2')),
      button(
        ctx.absoluteUrl(`/groups/${data.groupSlug}`),
        ctx.t('cta.viewGroup'),
      ),
    ].join('')
  },
}
