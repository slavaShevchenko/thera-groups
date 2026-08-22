export const formatPrice = (price: number, currency: string) => {
  const symbols: Record<string, string> = {
    UAH: '₴',
    USD: '$',
    EUR: '€',
  }

  return `${price} ${symbols[currency] ?? currency}`
}

export const formatDate = (value: string | Date, locale: string) => {
  const date = new Date(value)
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
