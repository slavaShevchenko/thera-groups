import { describe, it, expect } from 'vitest'
import ISO6391 from 'iso-639-1'
import { GROUP_LIMITS, LIMITS } from '../../shared/constants/limits'
import { updateGroupSchema } from '../../server/validators/group'
import { updateOrganizerProfileSchema } from '../../server/validators/organizerProfile'

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

function chars(length: number): string {
  return 'a'.repeat(length)
}

const question = (text: string) => ({
  question: text,
  type: 'TEXT' as const,
  required: false,
  options: [],
})

describe('updateGroupSchema limits', () => {
  it('a) rejects a title longer than TITLE_MAX', () => {
    expect(failedPaths(validPayload({ title: chars(GROUP_LIMITS.TITLE_MAX + 1) })))
      .toContain('title')
  })

  it('accepts a title exactly at TITLE_MAX', () => {
    expect(failedPaths(validPayload({ title: chars(GROUP_LIMITS.TITLE_MAX) }))).toEqual([])
  })

  it('b) rejects a description longer than DESCRIPTION_MAX', () => {
    expect(failedPaths(validPayload({ description: chars(GROUP_LIMITS.DESCRIPTION_MAX + 1) })))
      .toContain('description')
  })

  it('accepts a description exactly at DESCRIPTION_MAX', () => {
    expect(failedPaths(validPayload({ description: chars(GROUP_LIMITS.DESCRIPTION_MAX) }))).toEqual([])
  })

  it('c) rejects a program longer than PROGRAM_MAX', () => {
    expect(failedPaths(validPayload({ program: chars(GROUP_LIMITS.PROGRAM_MAX + 1) })))
      .toContain('program')
  })

  it('accepts a program exactly at PROGRAM_MAX', () => {
    expect(failedPaths(validPayload({ program: chars(GROUP_LIMITS.PROGRAM_MAX) }))).toEqual([])
  })

  it('d) rejects question text longer than QUESTION_TEXT_MAX', () => {
    expect(failedPaths(validPayload({ questions: [question(chars(GROUP_LIMITS.QUESTION_TEXT_MAX + 1))] })))
      .toContain('questions.0.question')
  })

  it('accepts question text exactly at QUESTION_TEXT_MAX', () => {
    expect(failedPaths(validPayload({ questions: [question(chars(GROUP_LIMITS.QUESTION_TEXT_MAX))] })))
      .toEqual([])
  })

  it('leaves the option text limit untouched at 200', () => {
    const choice = { ...question('Оберіть варіант'), type: 'SINGLE_CHOICE' as const, options: ['Так', chars(201)] }
    expect(failedPaths(validPayload({ questions: [choice] }))).toContain('questions.0.options.1')
  })
})

describe('updateGroupSchema new optional fields', () => {
  it('e) accepts a group carrying every new field', () => {
    expect(failedPaths(validPayload({
      program: '1. Знайомство\n2. Вправи на заземлення\n3. Підсумки',
      maxParticipants: 10,
      minParticipants: 4,
      durationHours: 12,
      certificateIssued: true,
    }))).toEqual([])
  })

  it('f) accepts a group without any of the new fields', () => {
    expect(failedPaths(validPayload())).toEqual([])
  })

  it('accepts certificateIssued false and null', () => {
    expect(failedPaths(validPayload({ certificateIssued: false }))).toEqual([])
    expect(failedPaths(validPayload({ certificateIssued: null }))).toEqual([])
  })

  it('accepts an empty program so the field can be cleared', () => {
    expect(failedPaths(validPayload({ program: '' }))).toEqual([])
  })

  it('accepts null for minParticipants and durationHours', () => {
    expect(failedPaths(validPayload({ minParticipants: null, durationHours: null }))).toEqual([])
  })

  it('rejects a non-boolean certificateIssued', () => {
    expect(failedPaths(validPayload({ certificateIssued: 'yes' }))).toContain('certificateIssued')
  })
})

describe('updateGroupSchema min/max cross-check', () => {
  it('g) rejects minParticipants above maxParticipants on the minParticipants field', () => {
    expect(failedPaths(validPayload({ maxParticipants: 10, minParticipants: 11 })))
      .toContain('minParticipants')
  })

  it('accepts minParticipants equal to maxParticipants', () => {
    expect(failedPaths(validPayload({ maxParticipants: 10, minParticipants: 10 }))).toEqual([])
  })

  it('accepts minParticipants below maxParticipants', () => {
    expect(failedPaths(validPayload({ maxParticipants: 10, minParticipants: 4 }))).toEqual([])
  })

  it('skips the cross-check when the maximum is not part of the patch', () => {
    expect(failedPaths(validPayload({ minParticipants: 500 }))).toEqual([])
  })

  it('h) rejects minParticipants of zero', () => {
    expect(failedPaths(validPayload({ minParticipants: 0 }))).toContain('minParticipants')
  })

  it('h) rejects a negative minParticipants', () => {
    expect(failedPaths(validPayload({ minParticipants: -3 }))).toContain('minParticipants')
  })

  it('i) rejects durationHours of zero', () => {
    expect(failedPaths(validPayload({ durationHours: 0 }))).toContain('durationHours')
  })

  it('i) rejects a negative durationHours', () => {
    expect(failedPaths(validPayload({ durationHours: -1 }))).toContain('durationHours')
  })

  it('rejects a fractional durationHours', () => {
    expect(failedPaths(validPayload({ durationHours: 1.5 }))).toContain('durationHours')
  })
})

describe('updateGroupSchema date range', () => {
  const start = '2026-11-15T17:00:00.000Z'

  it('rejects an endDate equal to startDate on the endDate field', () => {
    expect(failedPaths(validPayload({ startDate: start, endDate: start }))).toContain('endDate')
  })

  it('rejects an endDate before startDate', () => {
    expect(failedPaths(validPayload({ startDate: start, endDate: '2026-11-15T16:59:00.000Z' })))
      .toContain('endDate')
  })

  it('accepts an endDate after startDate', () => {
    expect(failedPaths(validPayload({ startDate: start, endDate: '2026-11-15T19:00:00.000Z' })))
      .toEqual([])
  })

  it('accepts a patch carrying only endDate', () => {
    expect(failedPaths(validPayload({ endDate: '2026-12-01T17:00:00.000Z' }))).toEqual([])
  })

  it('accepts a null endDate so a stored end date can be cleared', () => {
    expect(failedPaths(validPayload({ endDate: null }))).toEqual([])
  })

  it('skips the range cross-check when endDate is cleared next to startDate', () => {
    expect(failedPaths(validPayload({ startDate: start, endDate: null }))).toEqual([])
  })

  it('still rejects an endDate before startDate when both travel in the patch', () => {
    expect(failedPaths(validPayload({ startDate: start, endDate: '2026-11-15T16:00:00.000Z' })))
      .toContain('endDate')
  })

  it('accepts the ISO string a datetime-local input converts to', () => {
    expect(failedPaths(validPayload({
      startDate: new Date('2026-11-15T18:00').toISOString(),
      endDate: new Date('2026-11-15T20:00').toISOString(),
    }))).toEqual([])
  })

  it('rejects a raw datetime-local value that was never converted to ISO', () => {
    expect(failedPaths(validPayload({ startDate: '2026-11-15T18:00' }))).toContain('startDate')
  })

  it('rejects an empty date string', () => {
    expect(failedPaths(validPayload({ startDate: '' }))).toContain('startDate')
  })
})

describe('updateGroupSchema languages', () => {
  it('accepts an omitted field, leaving the stored codes alone', () => {
    expect(failedPaths(validPayload())).toEqual([])
  })

  it('accepts the single language most groups run in', () => {
    expect(failedPaths(validPayload({ languages: ['uk'] }))).toEqual([])
  })

  it('accepts several, which is the point of the field — a bilingual group or one with an interpreter', () => {
    expect(failedPaths(validPayload({ languages: ['uk', 'ru', 'es'] }))).toEqual([])
  })

  it('accepts an empty array so removing the last language clears the column', () => {
    expect(failedPaths(validPayload({ languages: [] }))).toEqual([])
  })

  it('rejects a word where a code belongs', () => {
    expect(failedPaths(validPayload({ languages: ['english'] }))).toContain('languages')
  })

  it('rejects a two-letter string that is not an ISO 639-1 code', () => {
    expect(failedPaths(validPayload({ languages: ['uk', 'zz'] }))).toContain('languages')
  })

  it('rejects more codes than LANGUAGE_CODES_MAX', () => {
    const tooMany = ISO6391.getAllCodes().slice(0, LIMITS.LANGUAGE_CODES_MAX + 1)

    expect(tooMany).toHaveLength(LIMITS.LANGUAGE_CODES_MAX + 1)
    expect(failedPaths(validPayload({ languages: tooMany }))).toContain('languages')
  })

  it('accepts exactly LANGUAGE_CODES_MAX codes', () => {
    const atMax = ISO6391.getAllCodes().slice(0, LIMITS.LANGUAGE_CODES_MAX)

    expect(atMax).toHaveLength(LIMITS.LANGUAGE_CODES_MAX)
    expect(failedPaths(validPayload({ languages: atMax }))).toEqual([])
  })

  it('validates against the same ceiling as the organizer profile', () => {
    // One constant, two columns: a group runs in the languages its organizer speaks, so the
    // two schemas accepting different vocabularies would only surface as a confusing 400.
    const atMax = ISO6391.getAllCodes().slice(0, LIMITS.LANGUAGE_CODES_MAX)

    expect(updateOrganizerProfileSchema.safeParse({ languages: atMax }).success).toBe(true)
    expect(updateOrganizerProfileSchema.safeParse({ languages: [...atMax, 'uk'] }).success).toBe(false)
  })
})
