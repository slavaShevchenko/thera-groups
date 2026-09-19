import { describe, it, expect } from 'vitest'
import {
  GROUP_TYPES,
  getGroupTypeByValue,
  getGroupTypeBySlug,
  groupTypeToSlug,
  slugToGroupType,
} from '../../shared/constants/groupTypes'

describe('groupTypes', () => {
  describe('GROUP_TYPES', () => {
    it('contains all expected types', () => {
      expect(GROUP_TYPES.length).toBe(19)
    })

    it('has unique values', () => {
      const values = GROUP_TYPES.map(t => t.value)
      expect(new Set(values).size).toBe(values.length)
    })

    it('has unique slugs', () => {
      const slugs = GROUP_TYPES.map(t => t.slug)
      expect(new Set(slugs).size).toBe(slugs.length)
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
