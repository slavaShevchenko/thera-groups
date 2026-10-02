import { describe, it, expect } from 'vitest'
import {
  GROUP_TYPES,
  LEGACY_SLUG_REDIRECTS,
  getGroupTypeByValue,
  getGroupTypeBySlug,
  groupTypeToSlug,
  slugToGroupType,
} from '../../shared/constants/groupTypes'

describe('groupTypes', () => {
  describe('GROUP_TYPES', () => {
    it('contains all expected types', () => {
      expect(GROUP_TYPES.length).toBe(17)
    })

    it('has unique values', () => {
      const values = GROUP_TYPES.map(t => t.value)
      expect(new Set(values).size).toBe(values.length)
    })

    it('has unique slugs', () => {
      const slugs = GROUP_TYPES.map(t => t.slug)
      expect(new Set(slugs).size).toBe(slugs.length)
    })

    it('includes the types added by the 2026-10 consolidation', () => {
      expect(getGroupTypeByValue('INTERVISION')).toEqual({ value: 'INTERVISION', slug: 'intervision' })
      expect(getGroupTypeByValue('SYMPOSIUM')).toEqual({ value: 'SYMPOSIUM', slug: 'symposium' })
      expect(getGroupTypeByValue('EDUCATIONAL_PROGRAMS'))
        .toEqual({ value: 'EDUCATIONAL_PROGRAMS', slug: 'educational-programs' })
    })

    it('no longer exposes the retired types', () => {
      for (const retired of ['FOUNDATION', 'ADVANCED', 'PROFESSIONAL', 'PARTNERSHIP', 'INTERNATIONAL']) {
        expect(getGroupTypeByValue(retired)).toBeUndefined()
      }
    })
  })

  describe('LEGACY_SLUG_REDIRECTS', () => {
    it('maps the three level slugs onto educational-programs', () => {
      expect(LEGACY_SLUG_REDIRECTS['foundation']).toBe('educational-programs')
      expect(LEGACY_SLUG_REDIRECTS['advanced']).toBe('educational-programs')
      expect(LEGACY_SLUG_REDIRECTS['professional']).toBe('educational-programs')
    })

    it('maps the removed catalogue types onto other', () => {
      expect(LEGACY_SLUG_REDIRECTS['partnership']).toBe('other')
      expect(LEGACY_SLUG_REDIRECTS['international']).toBe('other')
    })

    it('only redirects to slugs that still exist', () => {
      for (const target of Object.values(LEGACY_SLUG_REDIRECTS)) {
        expect(getGroupTypeBySlug(target)).toBeDefined()
      }
    })

    it('never lists a current slug as retired', () => {
      for (const legacy of Object.keys(LEGACY_SLUG_REDIRECTS)) {
        expect(getGroupTypeBySlug(legacy)).toBeUndefined()
      }
    })
  })

  describe('getGroupTypeByValue', () => {
    it('finds existing type', () => {
      const result = getGroupTypeByValue('THERAPEUTIC')
      expect(result).toEqual({ value: 'THERAPEUTIC', slug: 'therapeutic' })
    })

    it('finds AUTHOR_PROGRAM', () => {
      const result = getGroupTypeByValue('AUTHOR_PROGRAM')
      expect(result).toEqual({ value: 'AUTHOR_PROGRAM', slug: 'author-program' })
    })

    it('returns undefined for unknown value', () => {
      expect(getGroupTypeByValue('UNKNOWN')).toBeUndefined()
    })

    it('is case-sensitive', () => {
      expect(getGroupTypeByValue('therapeutic')).toBeUndefined()
    })
  })

  describe('getGroupTypeBySlug', () => {
    it('finds existing slug', () => {
      const result = getGroupTypeBySlug('workshop')
      expect(result).toEqual({ value: 'WORKSHOP', slug: 'workshop' })
    })

    it('finds hyphenated slug', () => {
      const result = getGroupTypeBySlug('lecture-course')
      expect(result).toEqual({ value: 'LECTURE_COURSE', slug: 'lecture-course' })
    })

    it('returns undefined for unknown slug', () => {
      expect(getGroupTypeBySlug('nonexistent')).toBeUndefined()
    })
  })

  describe('groupTypeToSlug', () => {
    it('converts value to slug', () => {
      expect(groupTypeToSlug('THERAPEUTIC')).toBe('therapeutic')
      expect(groupTypeToSlug('SEMINAR')).toBe('seminar')
      expect(groupTypeToSlug('LECTURE_COURSE')).toBe('lecture-course')
      expect(groupTypeToSlug('AUTHOR_PROGRAM')).toBe('author-program')
      expect(groupTypeToSlug('OTHER')).toBe('other')
    })

    it('returns empty string for unknown value', () => {
      expect(groupTypeToSlug('UNKNOWN')).toBe('')
    })
  })

  describe('slugToGroupType', () => {
    it('converts slug to value', () => {
      expect(slugToGroupType('therapeutic')).toBe('THERAPEUTIC')
      expect(slugToGroupType('seminar')).toBe('SEMINAR')
      expect(slugToGroupType('lecture-course')).toBe('LECTURE_COURSE')
      expect(slugToGroupType('author-program')).toBe('AUTHOR_PROGRAM')
    })

    it('returns empty string for unknown slug', () => {
      expect(slugToGroupType('nonexistent')).toBe('')
    })
  })

  describe('roundtrip conversion', () => {
    it('value → slug → value returns original', () => {
      for (const type of GROUP_TYPES) {
        expect(slugToGroupType(groupTypeToSlug(type.value))).toBe(type.value)
      }
    })

    it('slug → value → slug returns original', () => {
      for (const type of GROUP_TYPES) {
        expect(groupTypeToSlug(slugToGroupType(type.slug))).toBe(type.slug)
      }
    })
  })
})
