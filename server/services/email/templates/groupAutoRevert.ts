import { button, greeting, paragraph, reasonBlock } from '../renderer'
import type { TypedEmailTemplate } from '../types'

export const groupAutoRevertTemplate: TypedEmailTemplate<'group_auto_revert'> = {
  subjectKey: 'subject.groupAutoRevert',
  preheaderKey: 'groupAutoRevert.preheader',
  notificationType: 'GROUP_AUTO_REVERT',

  render(data, ctx) {
    return [
      greeting(data.recipientName, ctx),
      paragraph(ctx.t('groupAutoRevert.body1', { groupTitle: data.groupTitle })),
      // An edit can re-send every critical field without changing a single value; then there
      // is nothing to name and the body still explains the revert on its own.
      data.changedFields
        ? reasonBlock(ctx.t('groupAutoRevert.changedFields', { fields: data.changedFields }))
        : '',
      paragraph(ctx.t('groupAutoRevert.body2')),
      button(ctx.absoluteUrl(`/groups/edit/${data.groupSlug}`), ctx.t('cta.editGroup')),
    ].join('')
  },
}
