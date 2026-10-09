import { button, greeting, paragraph, reasonBlock } from '../renderer'
import type { TypedEmailTemplate } from '../types'

export const groupCancelledTemplate: TypedEmailTemplate<'group_cancelled'> = {
  subjectKey: 'subject.groupCancelled',
  preheaderKey: 'groupCancelled.preheader',
  notificationType: 'GROUP_CANCELLED',

  render(data, ctx) {
    const isOwner = data.audience === 'owner'

    return [
      greeting(data.recipientName, ctx),
      paragraph(ctx.t(
        isOwner ? 'groupCancelled.ownerBody1' : 'groupCancelled.applicantBody1',
        { groupTitle: data.groupTitle },
      )),
      data.reason ? reasonBlock(ctx.t('groupCancelled.reason', { reason: data.reason })) : '',
      paragraph(ctx.t(isOwner ? 'groupCancelled.ownerBody2' : 'groupCancelled.applicantBody2')),
      button(
        ctx.absoluteUrl(isOwner ? `/groups/${data.groupSlug}` : '/catalog'),
        ctx.t(isOwner ? 'cta.viewGroup' : 'cta.browseGroups'),
      ),
    ].join('')
  },
}
