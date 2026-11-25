import { describe, it, expect } from 'vitest'
import {
  addHoursToLocalInputValue,
  combineDateAndTimeToISO,
  formatDate,
  instantToInputValues,
  isDateRangeValid,
  toDateOnlyInputValue,
  toTimeOnlyInputValue,
} from '../../app/utils/format'
import { updateGroupSchema } from '../../server/validators/group'
import { LIMITS } from '../../shared/constants/limits'

describe('isDateRangeValid', () => {
  it('accepts an end after the start', () => {
    expect(isDateRangeValid('2026-11-15T18:00', '2026-11-15T20:00')).toBe(true)
  })

  it('rejects an end equal to the start, as the server and the DB CHECK do', () => {
    expect(isDateRangeValid('2026-11-15T18:00', '2026-11-15T18:00')).toBe(false)
  })

  it('rejects an end before the start', () => {
    expect(isDateRangeValid('2026-11-20T18:00', '2026-11-15T18:00')).toBe(false)
  })

  it('accepts ISO strings produced by buildPayload', () => {
    expect(isDateRangeValid('2026-11-15T16:00:00.000Z', '2026-11-15T18:00:00.000Z')).toBe(true)
    expect(isDateRangeValid('2026-11-15T16:00:00.000Z', '2026-11-15T16:00:00.000Z')).toBe(false)
  })

  it('does not judge when a bound is missing so the server stays the authority', () => {
    expect(isDateRangeValid('', '2026-11-15T18:00')).toBe(true)
    expect(isDateRangeValid('2026-11-15T18:00', '')).toBe(true)
  })

  it('does not judge unparsable values', () => {
    expect(isDateRangeValid('not-a-date', '2026-11-15T18:00')).toBe(true)
    expect(isDateRangeValid('2026-11-15T18:00', 'not-a-date')).toBe(true)
  })
})

describe('addHoursToLocalInputValue', () => {
  it('keeps the datetime-local format', () => {
    expect(addHoursToLocalInputValue('2026-11-15T18:00', 2)).toBe('2026-11-15T20:00')
  })

  it('rolls over midnight', () => {
    expect(addHoursToLocalInputValue('2026-11-15T23:00', 2)).toBe('2026-11-16T01:00')
  })

  it('rolls over the end of a month', () => {
    expect(addHoursToLocalInputValue('2026-11-30T23:30', 2)).toBe('2026-12-01T01:30')
  })
})

describe('end date picker pre-fill', () => {
  // Regression: the picker used to pre-fill endDate with a copy of startDate, so the
  // very first save after touching the field was rejected with 400 VALIDATION_FAILED.
  it('produces a range the server accepts', () => {
    const start = '2026-11-15T18:00'
    const end = addHoursToLocalInputValue(start, LIMITS.DEFAULT_END_OFFSET_HOURS)

    const parsed = updateGroupSchema.safeParse({
      title: 'Група підтримки при тривозі',
      startDate: new Date(start).toISOString(),
      endDate: new Date(end).toISOString(),
    })

    expect(parsed.success).toBe(true)
  })

  it('produces a valid range even when the offset crosses midnight', () => {
    const start = '2026-11-15T23:00'
    const end = addHoursToLocalInputValue(start, LIMITS.DEFAULT_END_OFFSET_HOURS)

    expect(isDateRangeValid(start, end)).toBe(true)
  })
})

describe('toDateOnlyInputValue', () => {
  it('formats a date as YYYY-MM-DD', () => {
    const date = new Date(2026, 10, 15, 18, 30) // Nov 15, 2026 18:30 local
    expect(toDateOnlyInputValue(date)).toBe('2026-11-15')
  })

  it('pads single-digit month and day', () => {
    const date = new Date(2026, 0, 5) // Jan 5, 2026
    expect(toDateOnlyInputValue(date)).toBe('2026-01-05')
  })
})

describe('toTimeOnlyInputValue', () => {
  it('formats a time as HH:MM', () => {
    const date = new Date(2026, 10, 15, 18, 30)
    expect(toTimeOnlyInputValue(date)).toBe('18:30')
  })

  it('pads single-digit hours and minutes', () => {
    const date = new Date(2026, 10, 15, 9, 5)
    expect(toTimeOnlyInputValue(date)).toBe('09:05')
  })
})

describe('combineDateAndTimeToISO', () => {
  it('combines date and time into an ISO string', () => {
    const result = combineDateAndTimeToISO('2026-11-15', '18:00', 'Europe/Kyiv')
    // Kyiv is UTC+2 in winter, so 18:00 Kyiv = 16:00 UTC
    expect(result).toMatch(/2026-11-15T16:00:00\.000Z/)
  })

  it('handles date-only (no time) as midnight', () => {
    const result = combineDateAndTimeToISO('2026-11-15', '', 'UTC')
    expect(result).toBe('2026-11-15T00:00:00.000Z')
  })

  it('falls back to UTC for invalid timezone', () => {
    const result = combineDateAndTimeToISO('2026-11-15', '12:00', 'Invalid/Zone')
    expect(result).toBe('2026-11-15T12:00:00.000Z')
  })
})

describe('instantToInputValues', () => {
  it('reads an instant back in the group timezone, not the browser one', () => {
    // Midnight on the 15th in Kyiv (UTC+2 in winter) is stored as 22:00Z on the 14th. Split
    // back out through `getDate()` that is the wrong day, and the next save moves the event.
    expect(instantToInputValues('2026-11-14T22:00:00.000Z', 'Europe/Kyiv'))
      .toEqual({ date: '2026-11-15', time: '00:00' })
  })

  it('round-trips combineDateAndTimeToISO in every zone the form offers', () => {
    const cases: Array<[string, string]> = [
      ['2026-07-04', '18:30'],
      ['2026-01-04', '00:00'],
      ['2026-11-15', '23:59'],
    ]

    for (const timezone of ['Europe/Kyiv', 'Europe/Warsaw', 'America/New_York', 'UTC']) {
      for (const [date, time] of cases) {
        const instant = combineDateAndTimeToISO(date, time, timezone)

        expect(instantToInputValues(instant, timezone), `${date} ${time} in ${timezone}`)
          .toEqual({ date, time })
      }
    }
  })

  it('renders midnight as 00:00 and not the 24:00 some ICU versions report', () => {
    expect(instantToInputValues('2026-11-15T00:00:00.000Z', 'UTC'))
      .toEqual({ date: '2026-11-15', time: '00:00' })
  })

  it('takes a Date as well as the ISO string the API sends', () => {
    expect(instantToInputValues(new Date('2026-11-14T22:00:00.000Z'), 'UTC'))
      .toEqual({ date: '2026-11-14', time: '22:00' })
  })

  it('falls back to UTC for a zone the runtime does not know, as combineDateAndTimeToISO does', () => {
    const instant = combineDateAndTimeToISO('2026-11-15', '12:00', 'Invalid/Zone')

    expect(instantToInputValues(instant, 'Invalid/Zone'))
      .toEqual({ date: '2026-11-15', time: '12:00' })
  })

  it('reads the browser zone when there is no timezone to be symmetric with', () => {
    const date = new Date(2026, 10, 15, 18, 30)

    expect(instantToInputValues(date, null))
      .toEqual({ date: toDateOnlyInputValue(date), time: toTimeOnlyInputValue(date) })
  })

  it('blanks both pickers for a value that is absent or unparsable', () => {
    for (const value of [null, undefined, '', 'not-a-date']) {
      expect(instantToInputValues(value, 'Europe/Kyiv')).toEqual({ date: '', time: '' })
    }
  })
})

describe('formatDate in a group timezone', () => {
  it('prints the day the event starts where it starts, not where the reader is', () => {
    // 22:00Z on the 14th is already the 15th in Kyiv. Without the zone the printed day
    // depends on who is reading while the time beside it — `formatTime`, which does take the
    // group's zone — says 00:00, so one row contradicts itself.
    expect(formatDate('2026-11-14T22:00:00.000Z', 'ua', 'Europe/Kyiv')).toContain('15')
    expect(formatDate('2026-11-14T22:00:00.000Z', 'ua', 'UTC')).toContain('14')
  })

  it('still prints the reader day for an instant with no zone of its own', () => {
    expect(formatDate('2026-11-15T12:00:00.000Z', 'en')).toContain('November')
  })

  it('falls back to the reader zone for a timezone the runtime does not know', () => {
    expect(formatDate('2026-11-15T12:00:00.000Z', 'en', 'Invalid/Zone')).toContain('November')
  })
})
