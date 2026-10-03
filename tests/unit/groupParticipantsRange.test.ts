import { describe, it, expect } from 'vitest'
import { isParticipantsRangeValid } from '../../app/utils/format'
import { updateGroupSchema } from '../../server/validators/group'

function validPayload(overrides: Record<string, unknown> = {}) {
  return {
    title: 'Група підтримки при тривозі',
    description: 'Безпечний простір для обговорення тривоги та вправи на заземлення.',
    type: 'THERAPEUTIC',
    format: 'ONLINE',
    startDate: '2026-11-15T10:00:00.000Z',
    ...overrides,
  }
}

function failedPaths(payload: unknown): string[] {
  const parsed = updateGroupSchema.safeParse(payload)
  return parsed.success ? [] : parsed.error.issues.map(issue => issue.path.join('.'))
}

describe('isParticipantsRangeValid', () => {
  it('accepts a minimum below the maximum', () => {
    expect(isParticipantsRangeValid(4, 10)).toBe(true)
  })

  it('accepts a minimum equal to the maximum', () => {
    expect(isParticipantsRangeValid(10, 10)).toBe(true)
  })

  it('rejects a minimum above the maximum', () => {
    expect(isParticipantsRangeValid(11, 10)).toBe(false)
  })

  it('does not judge when a bound is missing so the server stays the authority', () => {
    expect(isParticipantsRangeValid(null, 10)).toBe(true)
    expect(isParticipantsRangeValid(11, null)).toBe(true)
    expect(isParticipantsRangeValid(null, null)).toBe(true)
  })
})

describe('the client range check agrees with the server cross-check', () => {
  // Regression: min > max was caught only by the server superRefine, so autosave kept
  // firing PATCH requests that came back as 400 VALIDATION_FAILED with no inline error.
  it.each([
    [4, 10],
    [10, 10],
    [11, 10],
    [null, 10],
    [11, null],
  ] as Array<[number | null, number | null]>)('min=%s max=%s', (min, max) => {
    const rejectedByServer = failedPaths(validPayload({ minParticipants: min, maxParticipants: max }))
      .includes('minParticipants')

    expect(isParticipantsRangeValid(min, max)).toBe(!rejectedByServer)
  })
})
