import { useRoute, useRequestURL } from '#app'
import type { Locale } from '~~/types'

const langMap: Record<string, string> = { ua: 'uk', en: 'en' }

export const useLocaleHead = () => {
  const route = useRoute()
  const url = useRequestURL()
  const { locale } = useLocale() // ← добавить

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
    htmlAttrs: {
      lang: langMap[locale.value] || locale.value,
    },
    link: Object.entries(links).map(([hreflang, href]) => ({
      rel: 'alternate',
      hreflang,
      href,
    })) as any,
  }
}
