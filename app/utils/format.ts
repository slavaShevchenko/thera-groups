import { INTL_LOCALES } from '~~/shared/constants/locales'

export const formatDate = (
  value: string | Date | null | undefined,
  locale: string | Ref<string>,
  timezone?: string | null,
) => {
  if (value === null || value === undefined || value === '') return ''

  const date = new Date(value)

  if (isNaN(date.getTime())) return ''

  const localeStr = typeof locale === 'string' ? locale : locale.value
  const options: Intl.DateTimeFormatOptions = {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }

  // Without an explicit zone the day printed is the day where the reader happens to be, so
  // an event that starts at 22:00 UTC reads as the next day to a visitor in Kyiv — while the
  // time beside it, which `formatTime` renders in the group's own zone, says 22:00. A group
  // passes its timezone; an instant with no zone of its own (a notification, an application)
  // stays in the reader's, and SSR and hydration then agree either way because the zone is
  // data, not environment.
  if (timezone) options.timeZone = timezone

  try {
    return date.toLocaleDateString(INTL_LOCALES[localeStr] ?? localeStr, options)
  }
  catch {
    // An IANA name the runtime does not know makes this throw a RangeError. The day is more
    // useful than a blank, so drop the zone the way `formatTime` does.
    return date.toLocaleDateString(INTL_LOCALES[localeStr] ?? localeStr, {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
  }
}

/**
 * A bare `YYYY-MM-DD` calendar day as a localized long date.
 *
 * Not `formatDate()`, and the difference is the timezone. `new Date('2026-11-19')` parses a
 * date-only ISO string as **UTC** midnight, so formatting it in a browser west of Kyiv prints
 * the 18th — an article published on the 19th would show the 18th to every visitor in the
 * Americas, and SSR (Kyiv) and hydration (visitor's zone) would disagree on the same page.
 * Constructing from parts makes it local midnight instead, which formats as the 19th
 * everywhere. This is the client half of the server's `siteDayString()`: that one turns an
 * instant into the site day, this one renders a site day without moving it again.
 */
export function formatSiteDay(day: string | null | undefined, locale: string | Ref<string>): string {
  if (!day) return ''

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day)
  if (!match) return ''

  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  if (isNaN(date.getTime())) return ''

  const localeStr = typeof locale === 'string' ? locale : locale.value

  return date.toLocaleDateString(INTL_LOCALES[localeStr] ?? localeStr, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export const formatTime = (value: string | Date | null | undefined, timezone: string | null | undefined) => {
  if (value === null || value === undefined || value === '') return ''

  const date = new Date(value)

  if (isNaN(date.getTime())) return ''

  try {
    return date.toLocaleTimeString('uk-UA', {
      timeZone: timezone || 'Europe/Kyiv',
      hour: '2-digit',
      minute: '2-digit',
    })
  }
  catch {
    return date.toLocaleTimeString('uk-UA', {
      hour: '2-digit',
      minute: '2-digit',
    })
  }
}

export function formatGroupFormat(format: string | null | undefined, t: (_key: string) => string): string {
  if (!format) return ''
  const labels: Record<string, string> = {
    ONLINE: t('common.formats.online'),
    OFFLINE: t('common.formats.offline'),
    HYBRID: t('common.formats.hybrid'),
    MIXED: t('common.formats.hybrid'),
  }
  return labels[format] ?? format
}

const currencySymbols: Record<string, string> = { UAH: '₴', USD: '$', EUR: '€' }

export function formatPrice(amount: number | null, currency: string, freeLabel: string): string {
  if (amount === null) return '—'
  if (amount === 0) return freeLabel
  return `${amount} ${currencySymbols[currency] ?? currency}`
}

export function toLocalInputValue(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  const h = String(date.getHours()).padStart(2, '0')
  const min = String(date.getMinutes()).padStart(2, '0')
  return `${y}-${m}-${d}T${h}:${min}`
}

export function toDateOnlyInputValue(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function toTimeOnlyInputValue(date: Date): string {
  const h = String(date.getHours()).padStart(2, '0')
  const min = String(date.getMinutes()).padStart(2, '0')
  return `${h}:${min}`
}

function utcInputValues(date: Date): { date: string, time: string } {
  const pad = (n: number) => String(n).padStart(2, '0')

  return {
    date: `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`,
    time: `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`,
  }
}

/**
 * The inverse of `combineDateAndTimeToISO`: a stored instant back into the `YYYY-MM-DD` and
 * `HH:MM` a date picker and a time picker hold, read in the group's timezone.
 *
 * `toDateOnlyInputValue` and `toTimeOnlyInputValue` read a `Date` through `getDate()` and
 * `getHours()`, which are browser-local, while `combineDateAndTimeToISO` interprets the same
 * parts in the *group's* zone. Filling a form with the first and saving it back through the
 * second moved the stored instant by the difference between the two zones on every edit
 * session, so an organizer who opened a group to change its title also changed when it
 * starts. With no timezone to read there is nothing to be symmetric with, and the pair
 * falls back to the browser's zone as before.
 */
export function instantToInputValues(
  value: string | Date | null | undefined,
  timezone?: string | null,
): { date: string, time: string } {
  if (value === null || value === undefined || value === '') {
    return { date: '', time: '' }
  }

  const date = value instanceof Date ? value : new Date(value)

  if (isNaN(date.getTime())) return { date: '', time: '' }
  if (!timezone) {
    return { date: toDateOnlyInputValue(date), time: toTimeOnlyInputValue(date) }
  }

  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(date)

    const part = (type: string) => parts.find(p => p.type === type)?.value ?? ''

    return {
      date: `${part('year')}-${part('month')}-${part('day')}`,
      // `hour12: false` renders midnight as '24' on some ICU versions, which a `type="time"`
      // input refuses to display and `combineDateAndTimeToISO` would read as the next day.
      time: `${String(Number(part('hour')) % 24).padStart(2, '0')}:${part('minute')}`,
    }
  }
  catch {
    // An IANA name the runtime does not know: read UTC, exactly the zone
    // `combineDateAndTimeToISO` falls back to, so the round trip still lands where it began.
    return utcInputValues(date)
  }
}

// Combines a date-only string (YYYY-MM-DD), an optional time (HH:MM), and a timezone
// into an ISO 8601 instant. The date and time are interpreted as being in the given timezone.
export function combineDateAndTimeToISO(date: string, time: string, timezone: string): string {
  const timeStr = time || '00:00'
  const dateTimeStr = `${date}T${timeStr}`

  try {
    // Step 1: Parse as if UTC to get a baseline instant
    const utcInstant = new Date(dateTimeStr + 'Z')

    // Step 2: Format that instant in the target timezone to see what local time it represents
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    })

    const parts = formatter.formatToParts(utcInstant)
    const tzYear = Number(parts.find(p => p.type === 'year')?.value)
    const tzMonth = Number(parts.find(p => p.type === 'month')?.value)
    const tzDay = Number(parts.find(p => p.type === 'day')?.value)
    const tzHour = Number(parts.find(p => p.type === 'hour')?.value) % 24
    const tzMinute = Number(parts.find(p => p.type === 'minute')?.value)

    // Step 3: The difference between the target local time and the UTC time is the offset
    const targetLocal = Date.UTC(tzYear, tzMonth - 1, tzDay, tzHour, tzMinute)
    const offsetMs = targetLocal - utcInstant.getTime()

    // Step 4: Subtract the offset from the target local time to get UTC
    const targetTime = Date.UTC(
      Number(date.slice(0, 4)),
      Number(date.slice(5, 7)) - 1,
      Number(date.slice(8, 10)),
      Number(timeStr.slice(0, 2)),
      Number(timeStr.slice(3, 5)),
    )

    return new Date(targetTime - offsetMs).toISOString()
  }
  catch {
    // Fallback: treat as UTC if timezone is invalid
    return new Date(dateTimeStr + 'Z').toISOString()
  }
}

export function addHoursToLocalInputValue(value: string, hours: number): string {
  const date = new Date(value)
  date.setHours(date.getHours() + hours)
  return toLocalInputValue(date)
}

// Mirrors the server rule "endsAt > startsAt". Returns true when the range cannot be
// judged (a bound is empty or unparsable) so the server stays the authority.
export function isDateRangeValid(start: string, end: string): boolean {
  if (!start || !end) return true

  const startTime = new Date(start).getTime()
  const endTime = new Date(end).getTime()

  if (isNaN(startTime) || isNaN(endTime)) return true

  return endTime > startTime
}

// Mirrors the server cross-check that reports on minParticipants. Returns true when the
// range cannot be judged (a bound is null) so the server stays the authority.
export function isParticipantsRangeValid(min: number | null, max: number | null): boolean {
  if (min == null || max == null) return true

  return min <= max
}
