import { describe, it, expect } from 'vitest'
import { buildHstsHeader, DEFAULT_HSTS_MAX_AGE } from '~~/shared/utils/securityHeaders'

describe('buildHstsHeader', () => {
  // The header cannot be revoked. A first deploy that ships a year of `max-age` with
  // `includeSubDomains` has pinned every subdomain to HTTPS for 365 days, including one
  // whose certificate later lapses, and there is no way to undo it from the server.
  it('starts at five minutes and does not include subdomains', () => {
    expect(buildHstsHeader()).toBe(`max-age=${DEFAULT_HSTS_MAX_AGE}`)
    expect(buildHstsHeader({})).toBe('max-age=300')
  })

  it('honours an explicit max-age, so raising it is a config change and not a code edit', () => {
    expect(buildHstsHeader({ HSTS_MAX_AGE: '86400' })).toBe('max-age=86400')
    expect(buildHstsHeader({ HSTS_MAX_AGE: '31536000' })).toBe('max-age=31536000')
  })

  it('adds includeSubDomains only when asked, and tolerates the usual spellings', () => {
    expect(buildHstsHeader({ HSTS_MAX_AGE: '31536000', HSTS_INCLUDE_SUBDOMAINS: 'true' }))
      .toBe('max-age=31536000; includeSubDomains')
    expect(buildHstsHeader({ HSTS_INCLUDE_SUBDOMAINS: ' TRUE ' }))
      .toBe('max-age=300; includeSubDomains')
  })

  it('does not add includeSubDomains for anything that is not true', () => {
    expect(buildHstsHeader({ HSTS_INCLUDE_SUBDOMAINS: 'yes' })).toBe('max-age=300')
    expect(buildHstsHeader({ HSTS_INCLUDE_SUBDOMAINS: '1' })).toBe('max-age=300')
    expect(buildHstsHeader({ HSTS_INCLUDE_SUBDOMAINS: '' })).toBe('max-age=300')
  })

  // A typo must not ship `max-age=abc`: browsers ignore a header they cannot parse, so the
  // deployment would look protected in the config and be unprotected in the browser.
  it.each(['abc', '-1', '1e6', '300;', '  ', '1.5'])(
    'falls back to the default for the unparsable value %j',
    (value) => {
      expect(buildHstsHeader({ HSTS_MAX_AGE: value })).toBe(`max-age=${DEFAULT_HSTS_MAX_AGE}`)
    },
  )

  it('accepts zero, which is how a rollout is rolled back', () => {
    expect(buildHstsHeader({ HSTS_MAX_AGE: '0' })).toBe('max-age=0')
  })
})
