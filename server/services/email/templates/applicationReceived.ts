import { button, greeting, paragraph } from '../renderer'
import type { TypedEmailTemplate } from '../types'

export const applicationReceivedTemplate: TypedEmailTemplate<'application_received'> = {
  subjectKey: 'subject.applicationReceived',
  preheaderKey: 'applicationReceived.preheader',
  notificationType: 'APPLICATION_RECEIVED',

  render(data, ctx) {
    return [
      greeting(data.recipientName, ctx),
      paragraph(ctx.t('applicationReceived.body1', {
        applicantName: data.applicantName,
        groupTitle: data.groupTitle,
      })),
      paragraph(ctx.t('applicationReceived.body2')),
      button(
        ctx.absoluteUrl(`/groups/applications/${data.groupSlug}`),
        ctx.t('cta.viewApplications'),
      ),
    ].join('')
  },
}
