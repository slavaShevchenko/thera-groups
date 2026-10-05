import { randomUUID } from 'node:crypto'
import { tEmail } from '../../i18n'
import type { InterpolationParams, Locale } from '../../i18n'
import { logHandlerError } from '../../utils/errorHandler'
import { renderLayout } from './renderer'
import { emailRegistry } from './registry'
import * as tracking from './tracking'
import { deliver, resolveEmailConfig } from './transport'
import type {
  EmailDeliveryResult,
  EmailTemplate,
  EmailTemplateEntry,
  RenderContext,
  SendEmailOptions,
  TemplateData,
} from './types'

/**
 * The single entry point for outbound mail.
 *
 * CONTRACT: `sendEmail` never rejects and never throws into its caller. A missing
 * template, a renderer bug, a provider outage or a database failure all end up as one
 * `[email]` log line plus an `EmailEvent` row describing what happened. Callers may await
 * it, but never have to wrap it in try/catch — that is what makes wiring email into an
 * existing flow safe by construction.
 */
export async function sendEmail<T extends EmailTemplate>(
  options: SendEmailOptions<T>,
): Promise<void> {
  let eventId: string | null = null

  try {
    const entry = emailRegistry[options.template] as EmailTemplateEntry | undefined

    if (!entry) {
      // An unknown template is a programming bug, not a delivery failure. It is recorded
      // in EmailEvent anyway, so it surfaces next to real failures and not only in logs.
      await tracking.recordFailure(
        {
          recipient: options.to,
          template: String(options.template),
          type: String(options.template),
          locale: options.locale,
          entityId: options.entityId ?? null,
        },
        `Unknown email template: ${String(options.template)}`,
      ).catch(noop)

      throw new Error(`Unknown email template: ${String(options.template)}`)
    }

    const { subject, html } = renderTemplateEmail(options)

    // A tracking write must not cost the message: without the row there is nowhere to
    // record the outcome, but delivery is still worth attempting.
    eventId = await tracking.createQueued({
      recipient: options.to,
      template: options.template,
      type: entry.notificationType ?? options.template,
      locale: options.locale,
      entityId: options.entityId ?? null,
    }).catch(() => null)

    const result = await deliver({
      to: options.to,
      template: options.template,
      subject,
      html,
      replyTo: options.replyTo,
      idempotencyKey: randomUUID(),
    })

    try {
      await persistResult(eventId, result, html)
    }
    catch (error) {
      // Deliberately not the outer catch: the message is already out, and marking it
      // FAILED here would contradict the provider's own acceptance.
      logHandlerError(error, { source: 'email' })
    }
  }
  catch (error) {
    logHandlerError(error, { source: 'email' })
    if (eventId) {
      await tracking.markFailed(eventId, errorMessage(error)).catch(noop)
    }
  }
}

/**
 * Fire-and-forget variant for HTTP handlers, where the response must not wait on a
 * provider round-trip that can take up to 30s across retries.
 */
export function sendEmailFireAndForget<T extends EmailTemplate>(
  options: SendEmailOptions<T>,
): void {
  void sendEmail(options).catch(noop)
}

/** Composes the subject line and the full HTML document for a template. */
export function renderTemplateEmail<T extends EmailTemplate>(
  options: SendEmailOptions<T>,
): { subject: string, html: string } {
  const entry = emailRegistry[options.template] as EmailTemplateEntry | undefined

  if (!entry) {
    throw new Error(`Unknown email template: ${String(options.template)}`)
  }

  const { siteUrl } = resolveEmailConfig()
  const ctx: RenderContext = {
    locale: options.locale,
    siteUrl,
    t: (key, params) => tEmail(key, options.locale, params),
    absoluteUrl: path => absoluteUrl(siteUrl, options.locale, path),
  }

  // Field names in every template payload match the `{placeholder}` tokens in the i18n
  // strings, so the payload doubles as the interpolation source for subject/preheader.
  const data = options.data as TemplateData
  const params = toInterpolationParams(data)

  const subject = tEmail(entry.subjectKey, options.locale, params)
  const preheader = tEmail(entry.preheaderKey, options.locale, params)

  return {
    subject,
    html: renderLayout({
      subject,
      preheader,
      bodyHtml: entry.render(data, ctx),
      ctx,
    }),
  }
}

async function persistResult(
  eventId: string | null,
  result: EmailDeliveryResult,
  html: string,
): Promise<void> {
  if (!eventId) return

  switch (result.status) {
    case 'sent':
      await tracking.markSent(eventId, result.providerId ?? null)
      return
    case 'skipped':
      await tracking.markSkipped(eventId, result.error ?? 'Delivery skipped')
      return
    case 'dev_preview':
      await tracking.markDevPreview(eventId, html)
      return
    case 'failed':
      await tracking.markFailed(eventId, result.error ?? 'Delivery failed')
      return
  }
}

/** `/groups/my-slug` → `https://site/ua/groups/my-slug`; `/` → `https://site/ua`. */
export function absoluteUrl(siteUrl: string, locale: Locale, path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`
  return `${siteUrl}/${locale}${normalized === '/' ? '' : normalized}`
}

function toInterpolationParams(data: TemplateData): InterpolationParams {
  const params: InterpolationParams = {}

  for (const [key, value] of Object.entries(data)) {
    if (typeof value === 'string' || typeof value === 'number') {
      params[key] = value
    }
  }

  return params
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown error'
}

function noop(): void {}

export type { EmailTemplate, SendEmailOptions } from './types'
