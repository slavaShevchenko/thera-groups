import type { NotificationType } from '@prisma/client'
import type { InterpolationParams, Locale } from '../../i18n'

/**
 * One entry per notification that reaches a mailbox. `group_starting` is absent on
 * purpose — see the note in `registry.ts`.
 */
export type EmailTemplate
  = | 'application_received'
    | 'application_submitted'
    | 'application_approved'
    | 'application_rejected'
    | 'application_withdrawn'
    | 'group_published'
    | 'group_rejected'
    | 'group_pending_review'
    | 'group_submitted'
    | 'group_auto_revert'
    | 'organizer_pending_review'
    | 'organizer_verified'
    | 'organizer_rejected'
    | 'organizer_welcome'

/**
 * Per-template payload. Everything a template needs to render, and nothing else:
 * URLs are derived from slugs inside the template so callers never hand-build links.
 *
 * Application answers are deliberately not part of any shape — they are sensitive and
 * must never leave the database in an email body (AGENTS.md §6).
 */
export interface TemplateDataMap {
  application_received: {
    recipientName?: string
    applicantName: string
    groupTitle: string
    groupSlug: string
  }
  application_submitted: {
    recipientName?: string
    groupTitle: string
    groupSlug: string
  }
  application_approved: {
    recipientName?: string
    groupTitle: string
    groupSlug: string
  }
  application_rejected: {
    recipientName?: string
    groupTitle: string
    groupSlug: string
  }
  application_withdrawn: {
    recipientName?: string
    applicantName: string
    groupTitle: string
    groupSlug: string
  }
  group_published: {
    recipientName?: string
    groupTitle: string
    groupSlug: string
  }
  group_rejected: {
    recipientName?: string
    groupTitle: string
    groupSlug: string
    reason: string
  }
  group_pending_review: {
    recipientName?: string
    groupTitle: string
  }
  group_submitted: {
    recipientName?: string
    groupTitle: string
    groupSlug: string
  }
  /**
   * `changedFields` is an already-localized, comma-separated list of the critical fields
   * whose edit pulled the group out of PUBLISHED — localized by the caller, which is the
   * only place that knows the recipient's locale before the template renders.
   */
  group_auto_revert: {
    recipientName?: string
    groupTitle: string
    groupSlug: string
    changedFields: string
  }
  organizer_pending_review: {
    recipientName?: string
    organizerName: string
  }
  organizer_verified: {
    recipientName?: string
    organizerName: string
  }
  organizer_rejected: {
    recipientName?: string
    organizerName: string
    reason: string
  }
  organizer_welcome: {
    recipientName?: string
  }
}

export type TemplateData = TemplateDataMap[EmailTemplate]

export interface RenderContext {
  locale: Locale
  /** Absolute site origin without a trailing slash, from `SITE_URL`. */
  siteUrl: string
  /** Bound to `locale`, so templates call `t('subject.x', { name })`. */
  t: (_key: string, _params?: InterpolationParams) => string
  /** Turns `/groups/my-slug` into an absolute, locale-prefixed URL. */
  absoluteUrl: (_path: string) => string
}

/** Shape stored in the registry: `render` accepts the union of every template payload. */
export interface EmailTemplateEntry {
  /** i18n key for the subject line, e.g. `subject.applicationApproved`. */
  subjectKey: string
  /** i18n key for the hidden preview text, e.g. `applicationApproved.preheader`. */
  preheaderKey: string
  /** NotificationType written to `EmailEvent.type`; null for non-notification mail. */
  notificationType: NotificationType | null
  /** Renders the template's own markup; the base layout is applied by `renderer.ts`. */
  render: (_data: TemplateData, _ctx: RenderContext) => string
}

/**
 * How a template file declares itself. `registry.ts` widens it to `EmailTemplateEntry`,
 * which keeps `data` typed per template here instead of as the union of every payload.
 */
export interface TypedEmailTemplate<T extends EmailTemplate> {
  subjectKey: string
  preheaderKey: string
  notificationType: NotificationType | null
  render: (_data: TemplateDataMap[T], _ctx: RenderContext) => string
}

export interface SendEmailOptions<T extends EmailTemplate = EmailTemplate> {
  to: string
  template: T
  locale: Locale
  data: TemplateDataMap[T]
  replyTo?: string
  /** Domain identifier stored on `EmailEvent.entityId` (a slug, as today's rows use). */
  entityId?: string | null
}

/** Outcome of one `sendEmail()` call. Never throws — see the contract in `index.ts`. */
export type EmailDeliveryStatus = 'sent' | 'skipped' | 'dev_preview' | 'failed'

export interface EmailDeliveryResult {
  status: EmailDeliveryStatus
  /** Resend message id, present only when the provider accepted the message. */
  providerId?: string
  /** Raw failure reason. `tracking.sanitizeEmailError` scrubs it before it is persisted. */
  error?: string
  /** Rendered HTML, returned only for `dev_preview`. */
  html?: string
  /** Delivery attempts actually made against the provider. */
  attempts: number
}

export interface DeliverInput {
  to: string
  /** Carried for the dev-preview log line and nothing else. */
  template: EmailTemplate
  subject: string
  html: string
  replyTo?: string
  /** Stable across retries so Resend deduplicates a resent message. */
  idempotencyKey: string
}
