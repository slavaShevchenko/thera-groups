import { readdirSync, readFileSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, it, expect } from 'vitest'
import ua from '../../app/locales/ua.json'
import en from '../../app/locales/en.json'
import seoUa from '../../app/locales/seo.ua.json'
import seoEn from '../../app/locales/seo.en.json'

/**
 * `useLocale()` merges the UI bundle with the SEO one, and `t()` answers with the key
 * itself when a lookup misses. A typo therefore renders the literal string
 * `questions.delete` into an aria-label in production with nothing failing: the dev-only
 * `console.warn` is the only signal, and no test caught four of them.
 */
const messages = {
  ua: { ...ua, ...seoUa } as Record<string, unknown>,
  en: { ...en, ...seoEn } as Record<string, unknown>,
}

const APP_DIR = fileURLToPath(new URL('../../app', import.meta.url))
const LOCALES_DIR = fileURLToPath(new URL('../../app/locales', import.meta.url))

function sourceFiles(dir: string): string[] {
  const out: string[] = []

  for (const entry of readdirSync(dir)) {
    const path = `${dir}/${entry}`
    if (statSync(path).isDirectory()) {
      // The locale files are the dictionary itself, not a caller of it.
      if (path === LOCALES_DIR) continue
      out.push(...sourceFiles(path))
      continue
    }
    if (/\.(vue|ts)$/.test(entry)) out.push(path)
  }

  return out
}

/** `t('a.b')` / `tRaw('a.b')` with a literal key. Template strings and variables are skipped. */
const CALL = /(?<![A-Za-z0-9_$.])(t|tRaw)\(\s*'([A-Za-z0-9_.]+)'/g

interface Usage {
  key: string
  /** `t` must land on a string; `tRaw` may read a whole subtree, as `groupTypes` does. */
  raw: boolean
  files: Set<string>
}

function usedKeys(): Map<string, Usage> {
  const keys = new Map<string, Usage>()

  for (const file of sourceFiles(APP_DIR)) {
    const source = readFileSync(file, 'utf8')
    for (const match of source.matchAll(CALL)) {
      const [, fn, key] = match as unknown as [string, string, string]
      const where = file.replace(APP_DIR, 'app')
      const existing = keys.get(key)

      if (existing) {
        existing.raw = existing.raw && fn === 'tRaw'
        existing.files.add(where)
      }
      else {
        keys.set(key, { key, raw: fn === 'tRaw', files: new Set([where]) })
      }
    }
  }

  return keys
}

function resolve(bundle: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>(
    (acc, part) => (acc && typeof acc === 'object' ? (acc as Record<string, unknown>)[part] : undefined),
    bundle,
  )
}

function leafKeys(bundle: unknown, prefix = ''): Set<string> {
  const out = new Set<string>()

  for (const [key, value] of Object.entries(bundle as Record<string, unknown>)) {
    const path = prefix ? `${prefix}.${key}` : key
    if (value && typeof value === 'object') {
      for (const nested of leafKeys(value, path)) out.add(nested)
    }
    else {
      out.add(path)
    }
  }

  return out
}

describe('client locale dictionaries', () => {
  const keys = usedKeys()

  it('finds translation calls to check', () => {
    expect(keys.size).toBeGreaterThan(100)
  })

  it.each([...keys.values()].sort((a, b) => a.key.localeCompare(b.key)))(
    'resolves "$key" in both locales',
    ({ key, raw }) => {
      const usedIn = [...keys.get(key)!.files].join(', ')
      const resolvedUa = resolve(messages.ua, key)
      const resolvedEn = resolve(messages.en, key)

      expect(resolvedUa, `missing in ua.json — used in ${usedIn}`).not.toBeUndefined()
      expect(resolvedEn, `missing in en.json — used in ${usedIn}`).not.toBeUndefined()

      // A `t()` call renders its result straight into the DOM, so a subtree would print
      // as `[object Object]` — only `tRaw()` is allowed to read one.
      if (!raw) {
        expect(resolvedUa, `not a string in ua.json — used in ${usedIn}`).toBeTypeOf('string')
        expect(resolvedEn, `not a string in en.json — used in ${usedIn}`).toBeTypeOf('string')
      }
    },
  )

  it('has an identical key structure in ua and en', () => {
    const uaKeys = leafKeys(messages.ua)
    const enKeys = leafKeys(messages.en)

    expect([...uaKeys].filter(key => !enKeys.has(key)).sort()).toEqual([])
    expect([...enKeys].filter(key => !uaKeys.has(key)).sort()).toEqual([])
  })
})
