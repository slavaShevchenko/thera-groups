import { describe, it, expect } from 'vitest'
import {
  addHoursToLocalInputValue,
  isDateRangeValid,
  toDateOnlyInputValue,
  toTimeOnlyInputValue,
  combineDateAndTimeToISO,
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
