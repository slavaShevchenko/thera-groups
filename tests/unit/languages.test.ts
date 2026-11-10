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
    const matches = getLanguageOptions('ua').filter(l => l.searchName.includes('укр'))

    expect(matches).toHaveLength(1)
    expect(matches[0]).toMatchObject({ code: 'uk', label: 'Українська' })
  })

  it('matches the English name as well, lowercased', () => {
    // Somebody who cannot type "українська" still has to find Ukrainian.
    expect(getLanguageOptions('ua').some(l => l.searchName.includes('ukrainian'))).toBe(true)
  })

  it('builds the list once per locale and sorts it by translated name', () => {
    const optionsUa = getLanguageOptions('ua')
    const optionsEn = getLanguageOptions('en')

    expect(getLanguageOptions('ua')).toBe(optionsUa)
    expect(getLanguageOptions('en')).toBe(optionsEn)

    const labelsUa = optionsUa.map(l => l.label)
    expect([...labelsUa].sort((a, b) => a.localeCompare(b, 'uk'))).toEqual(labelsUa)

    const labelsEn = optionsEn.map(l => l.label)
    expect([...labelsEn].sort((a, b) => a.localeCompare(b, 'en'))).toEqual(labelsEn)
  })

  it('returns translated labels for Ukrainian locale', () => {
    const options = getLanguageOptions('ua')
    const ukrainian = options.find(l => l.code === 'uk')
    const english = options.find(l => l.code === 'en')

    expect(ukrainian?.label).toBe('Українська')
    expect(english?.label).toBe('Англійська')
  })

  it('returns translated labels for English locale', () => {
    const options = getLanguageOptions('en')
    const ukrainian = options.find(l => l.code === 'uk')
    const english = options.find(l => l.code === 'en')

    expect(ukrainian?.label).toBe('Ukrainian')
    expect(english?.label).toBe('English')
  })
})

describe('languageLabel', () => {
  it('returns the translated name for a known code in Ukrainian', () => {
    expect(languageLabel('uk', 'ua')).toBe('Українська')
    expect(languageLabel('en', 'ua')).toBe('Англійська')
  })

  it('returns the translated name for a known code in English', () => {
    expect(languageLabel('uk', 'en')).toBe('Ukrainian')
    expect(languageLabel('en', 'en')).toBe('English')
  })

  it('defaults to Ukrainian when locale is not specified', () => {
    expect(languageLabel('uk')).toBe('Українська')
  })

  it('returns the code itself for an unknown one, rather than an empty string', () => {
    // A stored code the library does not know still has to render as something.
    expect(languageLabel('zz', 'ua')).toBe('zz')
    expect(languageLabel('zz', 'en')).toBe('zz')
  })
})
