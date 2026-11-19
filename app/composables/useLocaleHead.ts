import { useRoute, useRuntimeConfig } from '#app'
import { useLocale } from './useLocale'
import { HREFLANG_LOCALES } from '~~/shared/constants/locales'
import type { Locale } from '~~/types'

/**
 * `<html lang>` and `hreflang` both want the BCP 47 primary subtag, which is what
 * `HREFLANG_LOCALES` holds. The same map feeds `sitemap.xml` and the Article JSON-LD's
 * `inLanguage`, so the three surfaces cannot disagree about what language a page is in.
 */
const LOCALE_PREFIXES = ['ua', 'en']

export const useLocaleHead = () => {
  const route = useRoute()
  const config = useRuntimeConfig()
  const { pathLocale } = useLocale()

  const locales: Locale[] = ['ua', 'en']
  const siteUrl = config.public.siteUrl as string

  const pathWithoutLocale = computed(() => {
    const segments = route.path.split('/').filter(Boolean)
    const first = segments[0]
    if (first && LOCALE_PREFIXES.includes(first)) {
      return '/' + segments.slice(1).join('/')
    }
    return route.path
  })

  // Use pathLocale (from route.path) so <html lang> always matches hreflang links,
  // even during setLocale() when locale.value updates before route.path.
  const htmlAttrs = computed(() => {
    const currentLocale = pathLocale.value
    return {
      lang: HREFLANG_LOCALES[currentLocale] || currentLocale,
    }
  })

  const link = computed(() => {
    const basePath = pathWithoutLocale.value
    const links: Array<{ rel: 'alternate', hreflang: string, href: string }> = []

    for (const loc of locales) {
      const hreflang = HREFLANG_LOCALES[loc] ?? loc
      const href = `${siteUrl}/${loc}${basePath}`
      links.push({
        rel: 'alternate',
        hreflang,
        href: href.replace(/\/$/, ''),
      })
    }

    const xDefaultHref = `${siteUrl}/ua${basePath}`
    links.push({
      rel: 'alternate',
      hreflang: 'x-default',
      href: xDefaultHref.replace(/\/$/, ''),
    })

    return links
  })

  return { htmlAttrs, link }
}
