import { describe, it, expect } from 'vitest'
import { slugify, randomSuffix, generateUniqueSlug } from '../../server/utils/slugify'
import { ConflictError } from '../../server/utils/domainErrors'

describe('slugify', () => {
  it('converts ASCII text to lowercase slug', () => {
    expect(slugify('Hello World')).toBe('hello-world')
  })

  it('replaces multiple spaces with single hyphen', () => {
    expect(slugify('hello   world')).toBe('hello-world')
  })

  it('removes special characters', () => {
    expect(slugify('hello! @world#')).toBe('hello-world')
  })

  it('transliterates Ukrainian characters', () => {
    expect(slugify('Група підтримки')).toBe('hrupa-pidtrymky')
  })

  it('transliterates ґ', () => {
    expect(slugify('ґрунт')).toBe('grunt')
  })

  it('transliterates є, і, ї, й', () => {
    expect(slugify('єдність')).toBe('yednist')
    expect(slugify('кімната')).toBe('kimnata')
    expect(slugify('їжа')).toBe('yizha')
    expect(slugify('майя')).toBe('maiya')
  })

  it('transliterates щ, ш, ч, ж', () => {
    expect(slugify('щастя')).toBe('shchastya')
    expect(slugify('школа')).toBe('shkola')
    expect(slugify('час')).toBe('chas')
    expect(slugify('життя')).toBe('zhyttya')
  })

  it('handles mixed Ukrainian and ASCII', () => {
    expect(slugify('Терапія Group')).toBe('terapiya-group')
  })

  it('removes leading and trailing hyphens', () => {
    expect(slugify('---hello---')).toBe('hello')
  })

  it('truncates to 40 characters', () => {
    const long = 'a'.repeat(100)
    const result = slugify(long)
    expect(result.length).toBeLessThanOrEqual(40)
  })

  it('handles null and undefined', () => {
    expect(slugify(null)).toBe('')
    expect(slugify(undefined)).toBe('')
  })

  it('handles empty string', () => {
    expect(slugify('')).toBe('')
  })

  it('handles numbers in text', () => {
    expect(slugify('Група 101')).toBe('hrupa-101')
  })

  it('removes soft sign (ь)', () => {
    expect(slugify('сь')).toBe('s')
  })
})

describe('randomSuffix', () => {
  it('returns string of default length 6', () => {
    const suffix = randomSuffix()
    expect(suffix).toHaveLength(6)
  })

  it('returns string of specified length', () => {
    expect(randomSuffix(8)).toHaveLength(8)
    expect(randomSuffix(2)).toHaveLength(2)
  })

  it('contains only hex characters', () => {
    const suffix = randomSuffix(100)
    expect(suffix).toMatch(/^[a-f0-9]+$/)
  })

  it('generates different values on subsequent calls', () => {
    const results = new Set(Array.from({ length: 20 }, () => randomSuffix()))
    expect(results.size).toBeGreaterThan(1)
  })
})

describe('generateUniqueSlug', () => {
  it('returns base slug without suffix when not taken', async () => {
    const isTaken = async () => false
    const slug = await generateUniqueSlug('Тестова група', isTaken)
    expect(slug).toBe('testova-hrupa')
  })

  it('retries with suffix when slug is taken', async () => {
    let callCount = 0
    const isTaken = async () => {
      callCount++
      return callCount <= 1
    }
    const slug = await generateUniqueSlug('Test', isTaken)
    expect(slug).toMatch(/^test-[a-f0-9]{6}$/)
    expect(callCount).toBe(2)
  })

  it('throws ConflictError after exhausting all attempts', async () => {
    const isTaken = async () => true
    await expect(generateUniqueSlug('Test', isTaken)).rejects.toThrow(ConflictError)
  })

  it('never exceeds 40 characters', async () => {
    const isTaken = async () => false
    const longTitle = 'a'.repeat(200)
    const slug = await generateUniqueSlug(longTitle, isTaken)
    expect(slug.length).toBeLessThanOrEqual(40)
  })

  it('does not start with a hyphen for empty/symbol-only titles', async () => {
    const isTaken = async () => false
    const slug = await generateUniqueSlug('!!!', isTaken)
    expect(slug).not.toMatch(/^-/)
    expect(slug).toMatch(/^item/)
  })

  it('does not end with a hyphen', async () => {
    const isTaken = async () => false
    const slug = await generateUniqueSlug('Test', isTaken)
    expect(slug).not.toMatch(/-$/)
  })
})
