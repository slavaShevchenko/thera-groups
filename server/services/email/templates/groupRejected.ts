import { button, greeting, paragraph, reasonBlock } from '../renderer'
import type { TypedEmailTemplate } from '../types'

export const groupRejectedTemplate: TypedEmailTemplate<'group_rejected'> = {
  subjectKey: 'subject.groupRejected',
  preheaderKey: 'groupRejected.preheader',
  notificationType: 'GROUP_REJECTED',

  render(data, ctx) {
    return [
      greeting(data.recipientName, ctx),
      paragraph(ctx.t('groupRejected.body1', { groupTitle: data.groupTitle })),
      reasonBlock(ctx.t('common.reasonLabel', { reason: data.reason })),
      paragraph(ctx.t('groupRejected.body2')),
      button(ctx.absoluteUrl(`/groups/edit/${data.groupSlug}`), ctx.t('cta.editGroup')),
    ].join('')
  },
}
