import { useRoute, useRuntimeConfig, useHead } from '#app'
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

const DEFAULT_OG_IMAGE_PATH = '/images/og-default.png'

function resolve(value: string | (() => string)): string {
  return typeof value === 'function' ? value() : value
}

export const useSeoPage = (config: SeoPageConfig) => {
  const { t } = useLocale()
  const route = useRoute()
  const runtimeConfig = useRuntimeConfig()
  const siteUrl = runtimeConfig.public.siteUrl as string

  const title = computed(() => resolve(config.title))
  const description = computed(() => resolve(config.description))

  const canonicalUrl = computed(() => {
    if (config.canonicalUrl) {
      const resolved = resolve(config.canonicalUrl)
      if (resolved) return resolved
    }
    return `${siteUrl}${route.path}`
  })

  const ogImage = computed(() => {
    const resolved = config.ogImage ? resolve(config.ogImage) : ''
    const defaultAbsolute = `${siteUrl}${DEFAULT_OG_IMAGE_PATH}`

    if (!resolved || resolved === t('seo.defaultOgImage')) {
      return defaultAbsolute
    }

    if (resolved.startsWith('http://') || resolved.startsWith('https://')) {
      return resolved
    }

    return `${siteUrl}${resolved.startsWith('/') ? '' : '/'}${resolved}`
  })

  const ogType = config.ogType ?? 'website'
  const robots = config.robots ?? 'index, follow'

  const jsonLdContent = computed(() => {
    if (!config.jsonLd) return undefined
    const resolved = resolve(typeof config.jsonLd === 'object' ? JSON.stringify(config.jsonLd) : config.jsonLd)
    return resolved || undefined
  })

  const headScript = computed(() => {
    if (!jsonLdContent.value) return undefined
    return [{ type: 'application/ld+json' as const, innerHTML: jsonLdContent.value }]
  })

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
    script: headScript,
  })
}
