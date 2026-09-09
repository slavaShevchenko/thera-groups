import { useHead, useRequestURL } from '#app'
import { useLocale } from './useLocale'
import { useLocaleHead } from './useLocaleHead'

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

export const useSeoPage = (config: SeoPageConfig) => {
  const { t } = useLocale()
  const requestURL = useRequestURL()
  const localeHead = useLocaleHead()

  const canonicalUrl = config.canonicalUrl ?? `${requestURL.origin}${useRoute().path}`
  const ogImage = config.ogImage ?? t('seo.defaultOgImage') ?? DEFAULT_OG_IMAGE
  const ogType = config.ogType ?? 'website'
  const robots = config.robots ?? 'index, follow'

  useHead({
    title: config.title as any,
    htmlAttrs: localeHead.htmlAttrs,
    link: [
      { rel: 'canonical', href: canonicalUrl as any },
      ...localeHead.link,
    ],
    meta: [
      { name: 'description', content: config.description as any },
      { name: 'robots', content: robots },
      { property: 'og:title', content: config.title as any },
      { property: 'og:description', content: config.description as any },
      { property: 'og:image', content: ogImage as any },
      { property: 'og:url', content: canonicalUrl as any },
      { property: 'og:type', content: ogType },
      { property: 'og:site_name', content: t('seo.siteName') },
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:title', content: config.title as any },
      { name: 'twitter:description', content: config.description as any },
      { name: 'twitter:image', content: ogImage as any },
    ],
    script: config.jsonLd
      ? [{ type: 'application/ld+json', innerHTML: config.jsonLd as any }]
      : undefined,
  })
}
