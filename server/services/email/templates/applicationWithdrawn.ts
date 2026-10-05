import { button, greeting, paragraph } from '../renderer'
import type { TypedEmailTemplate } from '../types'

export const applicationWithdrawnTemplate: TypedEmailTemplate<'application_withdrawn'> = {
  subjectKey: 'subject.applicationWithdrawn',
  preheaderKey: 'applicationWithdrawn.preheader',
  notificationType: 'APPLICATION_WITHDRAWN',

  render(data, ctx) {
    return [
      greeting(data.recipientName, ctx),
      paragraph(ctx.t('applicationWithdrawn.body1', {
        applicantName: data.applicantName,
        groupTitle: data.groupTitle,
      })),
      paragraph(ctx.t('applicationWithdrawn.body2')),
      button(
        ctx.absoluteUrl(`/groups/applications/${data.groupSlug}`),
        ctx.t('cta.viewApplications'),
      ),
    ].join('')
  },
}
