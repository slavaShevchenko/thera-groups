import { INTL_LOCALES } from '~~/shared/constants/locales'
import type { RenderContext } from './types'

/**
 * Email HTML cannot use the project's CSS custom properties: Gmail, Outlook and Apple
 * Mail strip `<style>` blocks and ignore `var()`, so every declaration here is inline
 * and every colour is a literal hex value. That is the one place AGENTS.md's "no hex
 * colours" rule cannot apply.
 *
 * Layout is table-based for the same reason — flexbox and grid are unreliable in
 * Outlook's Word rendering engine.
 */

const SITE_NAME = 'PsyGroup'

const FONT_STACK
  = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'

const PALETTE = {
  pageBackground: '#f1f5f9',
  cardBackground: '#ffffff',
  headerBackground: '#1e293b',
  headerAccent: '#94a3b8',
  text: '#0f172a',
  muted: '#64748b',
  border: '#e2e8f0',
  buttonBackground: '#4f46e5',
} as const

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** Attribute values also need the scheme checked — `javascript:` survives escaping. */
function escapeAttribute(value: string): string {
  const trimmed = value.trim()
  if (/^(javascript|data|vbscript):/i.test(trimmed)) return '#'
  return escapeHtml(trimmed)
}

export function paragraph(text: string): string {
  return `<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:${PALETTE.text};">${escapeHtml(text)}</p>`
}

export function button(href: string, label: string): string {
  return [
    '<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 20px;">',
    `<tr><td align="center" style="border-radius:8px;background-color:${PALETTE.buttonBackground};">`,
    `<a href="${escapeAttribute(href)}" target="_blank" rel="noopener" style="display:inline-block;padding:12px 28px;`,
    `font-size:15px;font-weight:600;line-height:1.4;color:#ffffff;text-decoration:none;border-radius:8px;">`,
    escapeHtml(label),
    '</a>',
    '</td></tr>',
    '</table>',
  ].join('')
}

/** Quoted free text — moderator-authored reasons, changed-field lists — escaped like any other value. */
export function reasonBlock(text: string): string {
  return [
    `<div style="margin:0 0 20px;padding:12px 16px;border-left:3px solid ${PALETTE.border};`,
    `background-color:${PALETTE.pageBackground};border-radius:0 6px 6px 0;`,
    `font-size:14px;line-height:1.6;color:${PALETTE.muted};">`,
    escapeHtml(text),
    '</div>',
  ].join('')
}

export function greeting(name: string | undefined, ctx: RenderContext): string {
  const trimmed = name?.trim()
  const text = trimmed
    ? ctx.t('common.greeting', { name: trimmed })
    : ctx.t('common.greetingGeneric')

  return `<p style="margin:0 0 20px;font-size:17px;line-height:1.4;font-weight:600;color:${PALETTE.text};">${escapeHtml(text)}</p>`
}

export function renderLayout(options: {
  subject: string
  preheader: string
  bodyHtml: string
  ctx: RenderContext
}): string {
  const { subject, preheader, bodyHtml, ctx } = options
  const lang = INTL_LOCALES[ctx.locale]?.split('-')[0] ?? ctx.locale
  const year = new Date().getFullYear()

  const footerLink = (href: string, label: string) =>
    `<a href="${escapeAttribute(href)}" target="_blank" rel="noopener" style="color:${PALETTE.muted};text-decoration:underline;">${escapeHtml(label)}</a>`

  return `<!doctype html>
<html lang="${escapeAttribute(lang)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background-color:${PALETTE.pageBackground};-webkit-text-size-adjust:100%;">
<!-- Preheader: hidden preview text shown beside the subject in most mail clients. -->
<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">${escapeHtml(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${PALETTE.pageBackground};padding:24px 12px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background-color:${PALETTE.cardBackground};border-radius:12px;overflow:hidden;">
<tr><td style="padding:24px 32px;background-color:${PALETTE.headerBackground};">
<a href="${escapeAttribute(ctx.absoluteUrl('/'))}" target="_blank" rel="noopener" style="color:#ffffff;font-size:20px;font-weight:700;text-decoration:none;font-family:${FONT_STACK};">${SITE_NAME}</a>
<div style="margin-top:4px;color:${PALETTE.headerAccent};font-size:13px;line-height:1.4;font-family:${FONT_STACK};">${escapeHtml(ctx.t('common.footer.tagline'))}</div>
</td></tr>
<tr><td style="padding:32px;font-family:${FONT_STACK};">${bodyHtml}</td></tr>
<tr><td style="padding:24px 32px;border-top:1px solid ${PALETTE.border};font-family:${FONT_STACK};font-size:12px;line-height:1.7;color:${PALETTE.muted};">
<div style="margin-bottom:12px;">${escapeHtml(ctx.t('common.footer.unsubscribeHint'))}</div>
<div style="margin-bottom:12px;">
${footerLink(ctx.absoluteUrl('/notifications'), ctx.t('common.footer.unsubscribe'))}
&nbsp;·&nbsp;${footerLink(ctx.absoluteUrl('/privacy'), ctx.t('common.footer.privacy'))}
&nbsp;·&nbsp;${footerLink(ctx.absoluteUrl('/terms'), ctx.t('common.footer.terms'))}
&nbsp;·&nbsp;${footerLink(ctx.absoluteUrl('/contacts'), ctx.t('common.footer.contact'))}
</div>
<div>${escapeHtml(ctx.t('common.footer.address'))}</div>
<div>${escapeHtml(ctx.t('common.footer.rights', { year }))}</div>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`
}
