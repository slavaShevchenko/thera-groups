import { describe, it, expect } from 'vitest'
import { SITE_TIMEZONE, startOfSiteDay } from '../../server/utils/siteTime'

/**
 * The site zone is Kyiv, so the expectations below are written as UTC instants: local
 * midnight is 22:00Z the day before in winter (UTC+2) and 21:00Z in summer (UTC+3).
 * Europe/Kyiv switches on the last Sunday of March and the last Sunday of October, and in
 * 2026 those are 29 March and 25 October.
 */
describe('startOfSiteDay', () => {
  it('reads the site zone as Kyiv', () => {
    expect(SITE_TIMEZONE).toBe('Europe/Kyiv')
  })

  it('returns the UTC instant a winter day begins at', () => {
    expect(startOfSiteDay('2026-01-15')).toEqual(new Date('2026-01-14T22:00:00.000Z'))
  })

  it('returns the UTC instant a summer day begins at', () => {
    expect(startOfSiteDay('2026-07-01')).toEqual(new Date('2026-06-30T21:00:00.000Z'))
  })

  it('measures the offset on the right side of the spring switch', () => {
    // Midnight on the switch day is still winter time; the clocks move at 03:00 local.
    expect(startOfSiteDay('2026-03-29')).toEqual(new Date('2026-03-28T22:00:00.000Z'))
    expect(startOfSiteDay('2026-03-30')).toEqual(new Date('2026-03-29T21:00:00.000Z'))
  })

  it('measures the offset on the right side of the autumn switch', () => {
    // Midnight on the switch back is still summer time; the clocks move at 04:00 local.
    expect(startOfSiteDay('2026-10-25')).toEqual(new Date('2026-10-24T21:00:00.000Z'))
    expect(startOfSiteDay('2026-10-26')).toEqual(new Date('2026-10-25T22:00:00.000Z'))
  })

  it('is not UTC midnight, which is what the filter used to compare against', () => {
    const start = startOfSiteDay('2026-11-05')

    expect(start).not.toEqual(new Date('2026-11-05T00:00:00.000Z'))
    expect(start!.getTime()).toBeLessThan(Date.parse('2026-11-05T00:00:00Z'))
  })

  it.each(['yesterday', '2026-1-5', '05.11.2026', '', '2026-11-05T00:00:00Z'])(
    'rejects %p, which is not a bare calendar date',
    (value) => {
      expect(startOfSiteDay(value)).toBeNull()
    },
  )

  it('rejects a date that does not exist', () => {
    expect(startOfSiteDay('2026-02-30')).toBeNull()
  })
})
