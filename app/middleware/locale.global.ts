const LOCALES = ['ua', 'en'] as const
const DEFAULT_LOCALE = 'ua'
const SKIP_PREFIXES = ['api', '_nuxt', 'favicon.ico', 'robots.txt', 'site.webmanifest', 'sitemap.xml']
const BOT_PATTERN = /bot|crawl|spider|slurp|googlebot|bingbot|yandex|baidu|duckduck/i

function isCrawler(userAgent: string | undefined): boolean {
  return !!userAgent && BOT_PATTERN.test(userAgent)
}

function hasLocaleCookie(cookieHeader: string | undefined): boolean {
  if (!cookieHeader) return false
  return cookieHeader.split(';').some((pair) => {
    const [key] = pair.trim().split('=')
    return key === 'locale'
  })
}

export default defineNuxtRouteMiddleware((to) => {
  if (SKIP_PREFIXES.some(prefix => to.path.startsWith(`/${prefix}`))) {
    return
  }

  const pathSegments = to.path.split('/').filter(Boolean)
  const firstSegment = pathSegments[0]
  const pathHasLocale = LOCALES.includes(firstSegment as typeof LOCALES[number])

  const cookieHeader = import.meta.server
    ? (useRequestHeaders(['cookie']) as Record<string, string>).cookie
    : document.cookie

  const cookieExists = hasLocaleCookie(cookieHeader)

  if (!cookieExists) {
    const userAgent = import.meta.server
      ? (useRequestHeaders(['user-agent']) as Record<string, string>)['user-agent']
      : navigator.userAgent

    if (isCrawler(userAgent)) {
      if (!pathHasLocale) {
        return navigateTo({ path: `/${DEFAULT_LOCALE}${to.path}`, query: to.query, hash: to.hash }, { redirectCode: 302 })
      }
      return
    }

    if (!pathHasLocale) {
      return navigateTo({ path: `/${DEFAULT_LOCALE}${to.path}`, query: to.query, hash: to.hash }, { redirectCode: 302 })
    }

    if (firstSegment !== DEFAULT_LOCALE) {
      const restOfPath = '/' + pathSegments.slice(1).join('/')
      return navigateTo({ path: `/${DEFAULT_LOCALE}${restOfPath}`, query: to.query, hash: to.hash }, { redirectCode: 302 })
    }

    return
  }

  const localeCookie = useCookie<string>('locale', {
    default: () => DEFAULT_LOCALE,
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
    path: '/',
  })

  const targetLocale = LOCALES.includes(localeCookie.value as typeof LOCALES[number])
    ? localeCookie.value
    : DEFAULT_LOCALE

  if (firstSegment !== targetLocale) {
    const restOfPath = pathHasLocale
      ? '/' + pathSegments.slice(1).join('/')
      : to.path
    const newPath = `/${targetLocale}${restOfPath}`
    return navigateTo({ path: newPath, query: to.query, hash: to.hash }, { redirectCode: 302 })
  }
})
