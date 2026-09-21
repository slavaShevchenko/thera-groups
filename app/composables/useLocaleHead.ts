import { useRoute, useRuntimeConfig } from '#app'
import { useLocale } from './useLocale'
import type { Locale } from '~~/types'

const langMap: Record<string, string> = { ua: 'uk', en: 'en' }
const LOCALE_PREFIXES = ['ua', 'en']

export const useLocaleHead = () => {
  const route = useRoute()
  const config = useRuntimeConfig()
  const { locale } = useLocale()

  const locales: Locale[] = ['ua', 'en']
  const siteUrl = config.public.siteUrl as string

  const pathWithoutLocale = computed(() => {
    const segments = route.path.split('/').filter(Boolean)
    if (segments.length > 0 && LOCALE_PREFIXES.includes(segments[0])) {
      return '/' + segments.slice(1).join('/')
    }
    return route.path
  })

  const htmlAttrs = computed(() => ({
    lang: langMap[locale.value] || locale.value,
  }))

  const link = computed(() => {
    const basePath = pathWithoutLocale.value
    const links: Array<{ rel: 'alternate', hreflang: string, href: string }> = []

    for (const loc of locales) {
      const hreflang = langMap[loc] ?? loc
      links.push({
        rel: 'alternate',
        hreflang,
        href: `${siteUrl}/${loc}${basePath}`,
      })
    }

    links.push({
      rel: 'alternate',
      hreflang: 'x-default',
      href: `${siteUrl}/ua${basePath}`,
    })

    return links
  })

  return { htmlAttrs, link }
}
