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

describe('slugify truncation', () => {
  it('cuts on a word boundary rather than mid-word', () => {
    expect(slugify('ochna-interviziina-hrupa-eagt-u-krakovi', 20)).toBe('ochna-interviziina')
  })

  it('hard-cuts a single word longer than the budget, because an empty slug is worse', () => {
    expect(slugify('supercalifragilistic', 10)).toBe('supercalif')
  })

  it('leaves a slug already inside the budget untouched', () => {
    expect(slugify('hrupa-pidtrymky', 60)).toBe('hrupa-pidtrymky')
  })

  it('accepts a wider budget than the 40 default', () => {
    const base = 'ochna-interviziina-hrupa-eagt-u-krakovi-dovha-nazva-hrupy'
    expect(slugify(base, 40)).not.toBe(slugify(base, 60))
    expect(slugify(base, 60)).toBe(base)
  })
})

describe('generateUniqueSlug options', () => {
  const isFree = async () => false

  it('appends a suffix on the first try when alwaysSuffix is set', async () => {
    const slug = await generateUniqueSlug('Тестова група', isFree, { alwaysSuffix: true })
    expect(slug).toMatch(/^testova-hrupa-[a-f0-9]{6}$/)
  })

  it('still offers the bare base by default, which is what organizer and article slugs want', async () => {
    expect(await generateUniqueSlug('Тестова група', isFree)).toBe('testova-hrupa')
  })

  /**
   * The reason `GROUP_LIMITS.SLUG_MAX` is wider than the 40 default: a group slug is cut from
   * a title, and at 40 the suffix budget ate the last words of a perfectly ordinary one.
   */
  it('keeps more of the title at a wider maxLength', async () => {
    const title = 'Очна інтервізійна група EAGT у Кракові'

    const at40 = await generateUniqueSlug(title, isFree, { alwaysSuffix: true, maxLength: 40 })
    const at60 = await generateUniqueSlug(title, isFree, { alwaysSuffix: true, maxLength: 60 })

    expect(at40).toMatch(/^ochna-interviziina-hrupa-eagt-u-[a-f0-9]{6}$/)
    expect(at60).toMatch(/^ochna-interviziina-hrupa-eagt-u-krakovi-[a-f0-9]{6}$/)
  })

  it('keeps the whole slug inside maxLength, suffix included', async () => {
    const slug = await generateUniqueSlug('група '.repeat(50), isFree, {
      alwaysSuffix: true,
      maxLength: 60,
    })

    expect(slug.length).toBeLessThanOrEqual(60)
    expect(slug).toMatch(/-[a-f0-9]{6}$/)
  })

  it('never leaves the base dangling on a hyphen before the suffix', async () => {
    const slug = await generateUniqueSlug('опис '.repeat(50), isFree, {
      alwaysSuffix: true,
      maxLength: 60,
    })

    expect(slug).not.toMatch(/--[a-f0-9]{6}$/)
    expect(slug).not.toMatch(/^-/)
    expect(slug).not.toMatch(/-$/)
  })
})
