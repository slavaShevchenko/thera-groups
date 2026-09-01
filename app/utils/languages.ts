import ISO6391 from 'iso-639-1'

export interface LanguageOption {
  code: string
  label: string
  searchName: string
}

export const languageOptions: LanguageOption[] = ISO6391.getAllCodes()
  .map(code => ({
    code,
    label: ISO6391.getNativeName(code),
    searchName: `${ISO6391.getNativeName(code)} ${ISO6391.getName(code)}`.toLowerCase(),
  }))
  .sort((a, b) => a.label.localeCompare(b.label))

export function languageLabel(code: string): string {
  return ISO6391.validate(code) ? ISO6391.getNativeName(code) : code
}
