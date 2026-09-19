import ua from './notifications/ua'
import en from './notifications/en'

type Locale = 'ua' | 'en'

const translations: Record<Locale, Record<string, { subject: string, body: string }>> = { ua, en }

export function t(
  key: string,
  locale: Locale = 'ua',
  params: Record<string, string> = {},
): { subject: string, body: string } {
  const translation = translations[locale]?.[key]
  if (!translation) return { subject: key, body: key }

  return {
    subject: interpolate(translation.subject, params),
    body: interpolate(translation.body, params),
  }
}

function interpolate(text: string, params: Record<string, string>): string {
  return text.replace(/\{(\w+)\}/g, (_, key) => params[key] || `{${key}}`)
}
