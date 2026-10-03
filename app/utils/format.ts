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

export function toDateInputValue(value: string | Date | null | undefined): string {
  if (!value) return ''
  const date = value instanceof Date ? value : new Date(value)
  if (isNaN(date.getTime())) return ''
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
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

export function fromDateInputValue(value: string): string | null {
  if (!value) return null
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return null
  return `${match[1]}-${match[2]}-${match[3]}`
}
