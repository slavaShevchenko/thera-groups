import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { GROUP_TYPES } from '../../shared/constants/groupTypes'

function readJson(relativePath: string) {
  return JSON.parse(readFileSync(new URL(relativePath, import.meta.url), 'utf8'))
}

const ua = readJson('../../app/locales/ua.json')
const en = readJson('../../app/locales/en.json')
const seoUa = readJson('../../app/locales/seo.ua.json')
const seoEn = readJson('../../app/locales/seo.en.json')

const values = GROUP_TYPES.map(t => t.value)
const slugs = GROUP_TYPES.map(t => t.slug)

// The type <select> in GroupFilters.vue and groups/edit/[slug].vue is built from the
// groupTypes locale object, so a missing key silently drops a type from the UI and a
// stale key offers a value the API and the database now reject.
describe('groupTypes locale coverage', () => {
  it.each([
    ['ua', ua],
    ['en', en],
  ])('%s lists exactly GROUP_TYPES, in the same order', (_locale, dict) => {
    expect(Object.keys(dict.groupTypes)).toEqual(values)
  })

  it.each([
    ['ua', ua],
    ['en', en],
  ])('%s has a non-empty label for every type', (_locale, dict) => {
    for (const value of values) {
      expect(typeof dict.groupTypes[value]).toBe('string')
      expect(dict.groupTypes[value].trim().length).toBeGreaterThan(0)
    }
  })

  it('has no retired type keys left', () => {
    const retired = ['FOUNDATION', 'ADVANCED', 'PROFESSIONAL', 'PARTNERSHIP', 'INTERNATIONAL']
    for (const dict of [ua, en]) {
      for (const value of retired) {
        expect(dict.groupTypes[value]).toBeUndefined()
      }
    }
  })
})

// catalog/[type].vue resolves typePages.<slug>.description and
// seo.typePages.<slug>.{title,description}; a missing slug renders the raw key.
describe('catalog type page copy coverage', () => {
  it.each([
    ['ua typePages', ua.typePages],
    ['en typePages', en.typePages],
  ])('%s describes every slug', (_label, node) => {
    for (const slug of slugs) {
      expect(node[slug]?.description).toBeTruthy()
    }
  })

  it.each([
    ['seo.ua typePages', seoUa.seo.typePages],
    ['seo.en typePages', seoEn.seo.typePages],
  ])('%s has title and description for every slug', (_label, node) => {
    for (const slug of slugs) {
      expect(node[slug]?.title).toBeTruthy()
      expect(node[slug]?.description).toBeTruthy()
    }
  })

  it.each([
    ['ua typePages', ua.typePages],
    ['en typePages', en.typePages],
    ['seo.ua typePages', seoUa.seo.typePages],
    ['seo.en typePages', seoEn.seo.typePages],
  ])('%s keeps no retired slug', (_label, node) => {
    for (const slug of ['foundation', 'advanced', 'professional', 'partnership', 'international']) {
      expect(node[slug]).toBeUndefined()
    }
  })
})

describe('ua/en key parity', () => {
  function flatten(obj: Record<string, unknown>, prefix = '', out: string[] = []): string[] {
    for (const [key, value] of Object.entries(obj)) {
      const path = prefix ? `${prefix}.${key}` : key
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        flatten(value as Record<string, unknown>, path, out)
      }
      else {
        out.push(path)
      }
    }
    return out
  }

  it('ua.json and en.json have identical key sets', () => {
    expect(flatten(ua).sort()).toEqual(flatten(en).sort())
  })

  it('seo.ua.json and seo.en.json have identical key sets', () => {
    expect(flatten(seoUa).sort()).toEqual(flatten(seoEn).sort())
  })
})
