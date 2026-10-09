import { describe, it, expect } from 'vitest'
import { isSafeReturnTo, resolveReturnTo } from '~~/app/utils/returnTo'

describe('isSafeReturnTo', () => {
  it('accepts a same-origin absolute path', () => {
    expect(isSafeReturnTo('/ua/groups/my')).toBe(true)
    expect(isSafeReturnTo('/ua/groups/edit/some-slug')).toBe(true)
    expect(isSafeReturnTo('/en/admin?tab=groups')).toBe(true)
    expect(isSafeReturnTo('/')).toBe(true)
  })

  it('rejects an absolute URL to another origin', () => {
    expect(isSafeReturnTo('https://evil.example/ua')).toBe(false)
    expect(isSafeReturnTo('http://evil.example')).toBe(false)
  })

  it('rejects a protocol-relative URL, which browsers resolve against the current scheme', () => {
    expect(isSafeReturnTo('//evil.example/ua')).toBe(false)
    expect(isSafeReturnTo('/\\evil.example/ua')).toBe(false)
  })

  it('rejects a non-path scheme', () => {
    expect(isSafeReturnTo('javascript:alert(1)')).toBe(false)
    expect(isSafeReturnTo('mailto:someone@evil.example')).toBe(false)
  })

  it('rejects a repeated query parameter, which arrives as an array', () => {
    expect(isSafeReturnTo(['/ua/groups/my', '//evil.example'])).toBe(false)
  })

  it('rejects anything that is not a string', () => {
    expect(isSafeReturnTo(undefined)).toBe(false)
    expect(isSafeReturnTo(null)).toBe(false)
    expect(isSafeReturnTo(42)).toBe(false)
    expect(isSafeReturnTo({})).toBe(false)
  })
})

describe('resolveReturnTo', () => {
  it('follows a safe destination', () => {
    expect(resolveReturnTo('/ua/groups/my', 'ua')).toBe('/ua/groups/my')
  })

  it('falls back to the locale home for an unsafe or absent one', () => {
    expect(resolveReturnTo('//evil.example', 'ua')).toBe('/ua/')
    expect(resolveReturnTo(undefined, 'en')).toBe('/en/')
  })
})
