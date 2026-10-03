import { describe, it, expect } from 'vitest'
import { addHoursToLocalInputValue, isDateRangeValid } from '../../app/utils/format'
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
