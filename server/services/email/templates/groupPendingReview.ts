import { button, greeting, paragraph } from '../renderer'
import type { TypedEmailTemplate } from '../types'

/** Addressed to administrators, so the CTA points at the moderation queue. */
export const groupPendingReviewTemplate: TypedEmailTemplate<'group_pending_review'> = {
  subjectKey: 'subject.groupPendingReview',
  preheaderKey: 'groupPendingReview.preheader',
  notificationType: 'GROUP_PENDING_REVIEW',

  render(data, ctx) {
    return [
      greeting(data.recipientName, ctx),
      paragraph(ctx.t('groupPendingReview.body1', { groupTitle: data.groupTitle })),
      paragraph(ctx.t('groupPendingReview.body2')),
      button(ctx.absoluteUrl('/admin'), ctx.t('cta.adminPanel')),
    ].join('')
  },
}
