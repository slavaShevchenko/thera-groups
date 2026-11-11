import { INTL_LOCALES } from '~~/shared/constants/locales'

export const formatDate = (value: string | Date | null | undefined, locale: string | Ref<string>) => {
  if (value === null || value === undefined || value === '') return ''

  const date = new Date(value)

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
