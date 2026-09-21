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
