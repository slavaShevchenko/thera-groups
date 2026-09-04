export const formatPrice = (price: string | number, currency: string) => {
  if (price === '' || price === null || price === undefined) return ''

  const symbols: Record<string, string> = {
    UAH: '₴',
    USD: '$',
    EUR: '€',
  }

  return `${price} ${symbols[currency] ?? currency}`
}

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
