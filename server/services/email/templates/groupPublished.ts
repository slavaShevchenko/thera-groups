import { button, greeting, paragraph } from '../renderer'
import type { TypedEmailTemplate } from '../types'

export const groupPublishedTemplate: TypedEmailTemplate<'group_published'> = {
  subjectKey: 'subject.groupPublished',
  preheaderKey: 'groupPublished.preheader',
  notificationType: 'GROUP_APPROVED',

  render(data, ctx) {
    return [
      greeting(data.recipientName, ctx),
      paragraph(ctx.t('groupPublished.body1', { groupTitle: data.groupTitle })),
      paragraph(ctx.t('groupPublished.body2')),
      button(ctx.absoluteUrl(`/groups/${data.groupSlug}`), ctx.t('cta.viewGroup')),
    ].join('')
  },
}
