export const INTL_LOCALES: Record<string, string> = {
  ua: 'uk-UA',
  en: 'en-GB',
} as const

/**
 * Open Graph spells locales with an underscore (`uk_UA`), not the BCP 47 hyphen `Intl`
 * needs, and only accepts its own list of them — both of these are on it. Derived from
 * `INTL_LOCALES` so the two spellings of the same locale cannot drift apart.
 */
export const OG_LOCALES: Record<string, string> = Object.fromEntries(
  Object.entries(INTL_LOCALES).map(([locale, intl]) => [locale, intl.replace('-', '_')]),
)
