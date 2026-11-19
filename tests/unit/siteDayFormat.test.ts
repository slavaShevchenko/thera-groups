import { describe, it, expect } from 'vitest'
import { ref } from 'vue'
import { formatSiteDay } from '../../app/utils/format'

describe('formatSiteDay', () => {
  /**
   * The whole reason this exists next to `formatDate`: an article carries a publication
   * *day*, and `new Date('2026-11-19')` is UTC midnight, which is the 18th anywhere west of
   * Greenwich. Building the date from its parts makes it local midnight instead, so the day
   * printed is the day stored no matter where the reader's browser is.
   */
  it('prints the day in the string rather than the day before it', () => {
    const formatted = formatSiteDay('2026-11-19', 'en')

    expect(formatted).toContain('19')
    expect(formatted).toContain('2026')
    expect(formatted).not.toContain('18')
  })

  it('names the month in the requested locale', () => {
    expect(formatSiteDay('2026-11-19', 'en')).toContain('November')
    expect(formatSiteDay('2026-11-19', 'ua')).toContain('листопад')
  })

  it('prints no time, because an article has a publication day and not a minute', () => {
    expect(formatSiteDay('2026-11-19', 'en')).not.toMatch(/\d{1,2}:\d{2}/)
  })

  it('takes the locale as a ref, which is what useLocale() hands over', () => {
    const locale = ref('en')

    expect(formatSiteDay('2026-11-19', locale)).toContain('November')

    locale.value = 'ua'
    expect(formatSiteDay('2026-11-19', locale)).toContain('листопад')
  })

  it('falls back to the raw tag for a locale the site does not map', () => {
    expect(formatSiteDay('2026-11-19', 'fr')).toContain('2026')
  })

  it('returns nothing for a day that is absent or not shaped like one', () => {
    for (const day of [null, undefined, '', '19.11.2026', '2026-11', 'yesterday']) {
      expect(formatSiteDay(day, 'ua')).toBe('')
    }
  })
})
