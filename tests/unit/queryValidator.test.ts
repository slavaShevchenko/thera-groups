import { describe, it, expect } from 'vitest'
import { MAX_EXCLUDE_IDS, organizerSearchQuerySchema } from '../../server/validators/query'

// Real User.id values are 25-char cuids (Prisma @default(cuid())).
function cuid(index: number): string {
  return `cmubxoh4r000bhixv7cqilts${index}`.slice(0, 25)
}

function excludeOf(count: number): string {
  return Array.from({ length: count }, (_, i) => cuid(i)).join(',')
}

function parse(query: Record<string, unknown>) {
  return organizerSearchQuerySchema.safeParse(query)
}

function failedPaths(query: Record<string, unknown>): string[] {
  const parsed = parse(query)
  return parsed.success ? [] : parsed.error.issues.map(issue => issue.path.join('.'))
}

describe('organizerSearchQuerySchema', () => {
  it('accepts the exclude list built for 2 co-organizers (owner + current user included)', () => {
    // CoOrganizersPicker sends picked co-organizers + ownerId + currentUserId.
    // 4 x 25-char cuids + 3 commas = 103 chars, which the old .max(100) rejected.
    const parsed = parse({ q: 'Олена', exclude: excludeOf(4) })

    expect(parsed.success).toBe(true)
    if (parsed.success) expect(parsed.data.exclude).toHaveLength(4)
  })

  it('accepts the realistic maximum list (10 co-organizers + owner + current user)', () => {
    expect(failedPaths({ q: 'Олена', exclude: excludeOf(12) })).toEqual([])
  })

  it('treats a missing exclude as undefined', () => {
    const parsed = parse({ q: 'Олена' })

    expect(parsed.success).toBe(true)
    if (parsed.success) expect(parsed.data.exclude).toBeUndefined()
  })

  it('normalizes an empty exclude to an empty list', () => {
    const parsed = parse({ q: 'Олена', exclude: '' })

    expect(parsed.success).toBe(true)
    if (parsed.success) expect(parsed.data.exclude).toEqual([])
  })

  it('trims ids and drops empty segments left by an unset ownerId', () => {
    const parsed = parse({ q: 'Олена', exclude: ` ${cuid(1)} , ,${cuid(2)},` })

    expect(parsed.success).toBe(true)
    if (parsed.success) expect(parsed.data.exclude).toEqual([cuid(1), cuid(2)])
  })

  it('accepts a repeated id (owner === current user)', () => {
    expect(failedPaths({ q: 'Олена', exclude: `${cuid(1)},${cuid(1)}` })).toEqual([])
  })

  it('rejects more than MAX_EXCLUDE_IDS ids', () => {
    expect(failedPaths({ q: 'Олена', exclude: excludeOf(MAX_EXCLUDE_IDS + 1) })).toContain('exclude')
  })

  it('rejects a single id longer than 50 characters', () => {
    expect(failedPaths({ q: 'Олена', exclude: 'a'.repeat(51) })).toContain('exclude.0')
  })

  it('rejects a query shorter than 2 characters', () => {
    expect(failedPaths({ q: 'О' })).toContain('q')
  })

  it('rejects a query longer than 200 characters', () => {
    expect(failedPaths({ q: 'a'.repeat(201) })).toContain('q')
  })
})
