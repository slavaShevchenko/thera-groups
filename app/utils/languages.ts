import ISO6391 from 'iso-639-1'
import type { LanguageOption, Locale } from '~~/types'
import { getLanguageName, getLanguageSearchNames } from './languageNames'

const cachedByLocale: Record<Locale, LanguageOption[]> = { ua: null as unknown as LanguageOption[], en: null as unknown as LanguageOption[] }

/**
 * Every ISO 639-1 language as `{ code, label, searchName }`, sorted by translated name and
 * built on first use per locale.
 *
 * The `label` is the translated language name in the current UI locale (Ukrainian or English).
 * The `searchName` combines both Ukrainian and English names so users can search in either
 * language regardless of the current UI locale.
 *
 * This used to be a `Proxy` over an empty array whose `get` trap filled the cache and then
 * forwarded the read. That only ever half-worked. `filter`, `some`, `map` and `slice` decide
 * whether an index exists with `HasProperty`, and with no `has` trap that fell through to the
 * *empty* target, so every index looked like a hole:
 *
 *   languageOptions.filter(…)   → [] for any query
 *   languageOptions.some(…)     → always false
 *   languageOptions.map(…).length → 183, of undefined
 *
 * The picker searched with `filter`, so it rendered an empty list and there was never
 * anything to pick — on the organizer profile as well as here. `[...languageOptions]` and
 * `.find()` worked, because iteration and `find` go through `get`; that is what kept the bug
 * out of sight.
 *
 * A function keeps the laziness — ~183 objects that most requests never need — and returns
 * a real array, so every array method behaves like one.
 */
export function getLanguageOptions(locale: Locale = 'ua'): LanguageOption[] {
  if (!cachedByLocale[locale]) {
    cachedByLocale[locale] = ISO6391.getAllCodes()
      .map((code) => {
        const label = getLanguageName(code, locale)
        const searchNames = getLanguageSearchNames(code)
        return {
          code,
          label,
          searchName: searchNames.join(' ').toLowerCase(),
        }
      })
      .sort((a, b) => a.label.localeCompare(b.label, locale === 'ua' ? 'uk' : 'en'))
  }

  return cachedByLocale[locale]
}

/**
 * Get the translated label for a language code in the current locale.
 * Falls back to the code itself if the language is unknown.
 */
export function languageLabel(code: string, locale: Locale = 'ua'): string {
  return ISO6391.validate(code) ? getLanguageName(code, locale) : code
}
