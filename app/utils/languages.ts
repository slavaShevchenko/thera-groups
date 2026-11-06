import ISO6391 from 'iso-639-1'
import type { LanguageOption } from '~~/types'

let cached: LanguageOption[] | null = null

/**
 * Every ISO 639-1 language as `{ code, label, searchName }`, sorted by native name and built
 * on first use.
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
 * A function keeps the laziness — ~183 objects that most requests never need — and returns a
 * real array, so every array method behaves like one.
 */
export function getLanguageOptions(): LanguageOption[] {
  if (!cached) {
    cached = ISO6391.getAllCodes()
      .map(code => ({
        code,
        label: ISO6391.getNativeName(code),
        searchName: `${ISO6391.getNativeName(code)} ${ISO6391.getName(code)}`.toLowerCase(),
      }))
      .sort((a, b) => a.label.localeCompare(b.label))
  }

  return cached
}

export function languageLabel(code: string): string {
  return ISO6391.validate(code) ? ISO6391.getNativeName(code) : code
}
