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

/**
 * The BCP 47 primary subtag per locale — `uk` for `ua`, `en` for `en` — which is the spelling
 * `hreflang`, `xml:lang` and schema.org `inLanguage` all ask for and `Intl` does not: `Intl`
 * wants a region it can format with, a language tag must not carry one, because `hreflang="uk-UA"`
 * would claim the page is for Ukrainian *as spoken in Ukraine* and Google would then treat
 * `en-GB` and `en-US` as different alternates of the same page.
 *
 * Derived from `INTL_LOCALES` for the same reason `OG_LOCALES` is: three spellings of the same
 * two locales, one source of truth.
 */
export const HREFLANG_LOCALES: Record<string, string> = Object.fromEntries(
  // `?? intl` because `noUncheckedIndexedAccess` types an index read as possibly absent; a
  // tag with no hyphen (`en`) has no region to drop and is already the value wanted.
  Object.entries(INTL_LOCALES).map(([locale, intl]) => [locale, intl.split('-')[0] ?? intl]),
)
