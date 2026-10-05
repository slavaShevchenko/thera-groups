import { button, greeting, paragraph } from '../renderer'
import type { TypedEmailTemplate } from '../types'

/** Addressed to administrators, so the CTA points at the verification queue. */
export const organizerPendingReviewTemplate: TypedEmailTemplate<'organizer_pending_review'> = {
  subjectKey: 'subject.organizerPendingReview',
  preheaderKey: 'organizerPendingReview.preheader',
  notificationType: 'ORGANIZER_PENDING_REVIEW',

  render(data, ctx) {
    return [
      greeting(data.recipientName, ctx),
      paragraph(ctx.t('organizerPendingReview.body1', { organizerName: data.organizerName })),
      paragraph(ctx.t('organizerPendingReview.body2')),
      button(ctx.absoluteUrl('/admin'), ctx.t('cta.adminPanel')),
    ].join('')
  },
}
