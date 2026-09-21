import ISO6391 from 'iso-639-1'
import type { LanguageOption } from '~~/types'

let cached: LanguageOption[] | null = null

export const languageOptions = new Proxy([] as LanguageOption[], {
  get(_target, prop) {
    if (!cached) {
      cached = ISO6391.getAllCodes()
        .map(code => ({
          code,
          label: ISO6391.getNativeName(code),
          searchName: `${ISO6391.getNativeName(code)} ${ISO6391.getName(code)}`.toLowerCase(),
        }))
        .sort((a, b) => a.label.localeCompare(b.label))
    }
    return Reflect.get(cached, prop)
  },
})

export function languageLabel(code: string): string {
  return ISO6391.validate(code) ? ISO6391.getNativeName(code) : code
}
