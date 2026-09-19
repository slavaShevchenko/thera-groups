import { useHead, useRequestURL } from '#app'
import { useLocale } from './useLocale'

interface SeoPageConfig {
  title: string | (() => string)
  description: string | (() => string)
  canonicalUrl?: string | (() => string)
  ogImage?: string | (() => string)
  ogType?: string
  robots?: string
  jsonLd?: string | Record<string, unknown> | (() => string)
}

const DEFAULT_OG_IMAGE = '/images/og-default.png'

function resolve(value: string | (() => string)): string {
  return typeof value === 'function' ? value() : value
}

export const useSeoPage = (config: SeoPageConfig) => {
  const { t } = useLocale()
  const requestURL = useRequestURL()

  const canonicalUrl = resolve(config.canonicalUrl ?? `${requestURL.origin}${useRoute().path}`)
  const ogImage = resolve(config.ogImage ?? t('seo.defaultOgImage') ?? DEFAULT_OG_IMAGE)
  const ogType = config.ogType ?? 'website'
  const robots = config.robots ?? 'index, follow'
  const title = resolve(config.title)
  const description = resolve(config.description)

  useHead({
    title,
    link: [
      { rel: 'canonical', href: canonicalUrl },
    ],
    meta: [
      { name: 'description', content: description },
      { name: 'robots', content: robots },
      { property: 'og:title', content: title },
      { property: 'og:description', content: description },
      { property: 'og:image', content: ogImage },
      { property: 'og:url', content: canonicalUrl },
      { property: 'og:type', content: ogType },
      { property: 'og:site_name', content: t('seo.siteName') },
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:title', content: title },
      { name: 'twitter:description', content: description },
      { name: 'twitter:image', content: ogImage },
    ],
    script: config.jsonLd
      ? [{ type: 'application/ld+json', innerHTML: resolve(typeof config.jsonLd === 'object' ? JSON.stringify(config.jsonLd) : config.jsonLd) }]
      : undefined,
  })
}
