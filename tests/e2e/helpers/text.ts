import enMessages from '../../../app/locales/en.json' with { type: 'json' }
import uaMessages from '../../../app/locales/ua.json' with { type: 'json' }

type Dictionary = Record<string, unknown>

const dictionaries = {
  ua: uaMessages as Dictionary,
  en: enMessages as Dictionary,
}

function resolve(dictionary: Dictionary, key: string): string {
  const value = key
    .split('.')
    .reduce<unknown>((acc, part) => (acc as Dictionary | undefined)?.[part], dictionary)

  return typeof value === 'string' ? value : key
}

function interpolate(value: string, params?: Record<string, string | number>): string {
  if (!params) return value

  return Object.entries(params).reduce(
    (acc, [key, param]) => acc.replace(new RegExp(`\\{${key}\\}`, 'g'), String(param)),
    value,
  )
}

// Reads the real locale bundles so assertions follow copy changes instead of
// duplicating Ukrainian/English strings inside the specs.
export function t(key: string, params?: Record<string, string | number>): string {
  return interpolate(resolve(dictionaries.ua, key), params)
}

export function tEn(key: string, params?: Record<string, string | number>): string {
  return interpolate(resolve(dictionaries.en, key), params)
}
