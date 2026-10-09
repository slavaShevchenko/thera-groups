import { button, greeting, paragraph } from '../renderer'
import type { TypedEmailTemplate } from '../types'

export const groupCompletedTemplate: TypedEmailTemplate<'group_completed'> = {
  subjectKey: 'subject.groupCompleted',
  preheaderKey: 'groupCompleted.preheader',
  notificationType: 'GROUP_COMPLETED',

  render(data, ctx) {
    const isOwner = data.audience === 'owner'

    return [
      greeting(data.recipientName, ctx),
      paragraph(ctx.t(
        isOwner ? 'groupCompleted.ownerBody1' : 'groupCompleted.applicantBody1',
        { groupTitle: data.groupTitle },
      )),
      paragraph(ctx.t(isOwner ? 'groupCompleted.ownerBody2' : 'groupCompleted.applicantBody2')),
      // The owner still has a page to look at — the group stays in the catalog as an
      // archive. An applicant has nothing left to do there, so they get the catalog.
      button(
        ctx.absoluteUrl(isOwner ? `/groups/${data.groupSlug}` : '/catalog'),
        ctx.t(isOwner ? 'cta.viewGroup' : 'cta.browseGroups'),
      ),
    ].join('')
  },
}
