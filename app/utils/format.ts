export const formatDate = (value: string | Date | null | undefined, locale: string) => {
  if (value === null || value === undefined || value === '') return ''

  const date = new Date(value)

  if (isNaN(date.getTime())) return ''

  const locales: Record<string, string> = {
    ua: 'uk-UA',
    en: 'en-GB',
  }

  return date.toLocaleDateString(locales[locale] ?? locale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
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
