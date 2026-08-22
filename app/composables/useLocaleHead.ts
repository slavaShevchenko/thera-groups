import { useRoute, useRequestURL } from '#app'
import type { Locale } from './useLocale'

export const useLocaleHead = () => {
  const route = useRoute()
  const url = useRequestURL()

  const locales: Locale[] = ['ua', 'en']
  const links: Record<string, string> = {}

  const pathSegments = route.path.split('/').filter(Boolean)
  const cleanPath = pathSegments.slice(1).join('/')
  const basePath = cleanPath ? `/${cleanPath}` : ''

  locales.forEach((loc) => {
    links[loc] = `${url.origin}/${loc}${basePath}`
  })

  links['x-default'] = `${url.origin}/ua${basePath}`

  return {
    link: Object.entries(links).map(([hreflang, href]) => ({
      rel: 'alternate',
      hreflang,
      href,
    })),
  }
}
