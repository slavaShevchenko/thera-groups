import { describe, it, expect } from 'vitest'
import { getLanguageOptions, languageLabel } from '../../app/utils/languages'

describe('getLanguageOptions', () => {
  it('lists the whole ISO 639-1 set', () => {
    expect(getLanguageOptions().length).toBeGreaterThan(180)
  })

  it('returns a real array, so filter actually filters', () => {
    // Regression. This was a Proxy over an empty array: `filter` asks HasProperty before it
    // reads an index, that fell through to the empty target, and every search came back with
    // nothing to pick — the language picker rendered an empty list.
    const matches = getLanguageOptions().filter(l => l.searchName.includes('укр'))

    expect(matches).toHaveLength(1)
    expect(matches[0]).toMatchObject({ code: 'uk', label: 'Українська' })
  })

  it('matches the English name as well, lowercased', () => {
    // Somebody who cannot type "українська" still has to find Ukrainian.
    expect(getLanguageOptions().some(l => l.searchName.includes('ukrainian'))).toBe(true)
  })

  it('builds the list once and sorts it by native name', () => {
    const options = getLanguageOptions()

    expect(getLanguageOptions()).toBe(options)

    const labels = options.map(l => l.label)
    expect([...labels].sort((a, b) => a.localeCompare(b))).toEqual(labels)
  })
})

describe('languageLabel', () => {
  it('returns the native name for a known code', () => {
    expect(languageLabel('uk')).toBe('Українська')
  })

  it('returns the code itself for an unknown one, rather than an empty string', () => {
    // A stored code the library does not know still has to render as something.
    expect(languageLabel('zz')).toBe('zz')
  })
})
