import { describe, it, expect } from 'vitest'
import { parsePagination } from '../../server/utils/pagination'

describe('parsePagination', () => {
  it('returns defaults for empty query', () => {
    expect(parsePagination({})).toEqual({ page: 1, limit: 20, skip: 0 })
  })

  it('parses page and limit', () => {
    expect(parsePagination({ page: 3, limit: 10 })).toEqual({ page: 3, limit: 10, skip: 20 })
  })

  it('calculates skip correctly', () => {
    expect(parsePagination({ page: 1, limit: 50 })).toEqual({ page: 1, limit: 50, skip: 0 })
    expect(parsePagination({ page: 5, limit: 20 })).toEqual({ page: 5, limit: 20, skip: 80 })
  })

  it('clamps page to minimum 1', () => {
    expect(parsePagination({ page: 0 })).toEqual({ page: 1, limit: 20, skip: 0 })
    expect(parsePagination({ page: -5 })).toEqual({ page: 1, limit: 20, skip: 0 })
  })

  it('clamps limit to minimum 1', () => {
    expect(parsePagination({ limit: -10 })).toEqual({ page: 1, limit: 1, skip: 0 })
  })

  it('treats 0 limit as falsy and uses default', () => {
    expect(parsePagination({ limit: 0 })).toEqual({ page: 1, limit: 20, skip: 0 })
  })

  it('clamps limit to maximum 100', () => {
    expect(parsePagination({ limit: 200 })).toEqual({ page: 1, limit: 100, skip: 0 })
    expect(parsePagination({ limit: 1000 })).toEqual({ page: 1, limit: 100, skip: 0 })
  })

  it('handles string numbers', () => {
    expect(parsePagination({ page: '2', limit: '15' })).toEqual({ page: 2, limit: 15, skip: 15 })
  })

  it('handles NaN values', () => {
    expect(parsePagination({ page: 'abc', limit: 'xyz' })).toEqual({ page: 1, limit: 20, skip: 0 })
  })

  it('handles null values', () => {
    expect(parsePagination({ page: null, limit: null })).toEqual({ page: 1, limit: 20, skip: 0 })
  })
})
