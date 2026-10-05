import ua from './notifications/ua'
import en from './notifications/en'
import emailUa from './email/ua'
import emailEn from './email/en'

export type Locale = 'ua' | 'en'
export type InterpolationParams = Record<string, string | number>

const translations: Record<Locale, Record<string, { subject: string, body: string }>> = { ua, en }
const emailTranslations: Record<Locale, Record<string, string>> = { ua: emailUa, en: emailEn }

export function t(
  key: string,
  locale: Locale = 'ua',
  params: InterpolationParams = {},
): { subject: string, body: string } {
  const translation = translations[locale]?.[key]
  if (!translation) return { subject: key, body: key }

  return {
    subject: interpolate(translation.subject, params),
    body: interpolate(translation.body, params),
  }
}

/**
 * Single-string lookup for email templates (subjects, body paragraphs, CTA labels,
 * footer). Kept separate from `t()` because notifications store a subject/body pair
 * in the database while a template composes many individual strings.
 *
 * A missing key resolves to the key itself rather than to the other locale, so a
 * ua/en parity gap is visible in the delivered email instead of silently changing
 * the recipient's language. `tests/server/email/localeParity.test.ts` fails the build
 * on any gap.
 */
export function tEmail(
  key: string,
  locale: Locale = 'ua',
  params: InterpolationParams = {},
): string {
  const translation = emailTranslations[locale]?.[key]
  if (!translation) return key

  return interpolate(translation, params)
}

export const emailTranslationKeys: Record<Locale, readonly string[]> = {
  ua: Object.keys(emailUa),
  en: Object.keys(emailEn),
}

function interpolate(text: string, params: InterpolationParams): string {
  return text.replace(
    /\{(\w+)\}/g,
    (token, key: string) => (params[key] === undefined ? token : String(params[key])),
  )
}
