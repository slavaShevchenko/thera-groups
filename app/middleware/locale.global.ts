const LOCALES = ['ua', 'en'] as const
const DEFAULT_LOCALE = 'ua'
const SKIP_PREFIXES = ['api', '_nuxt', 'favicon.ico', 'robots.txt', 'site.webmanifest', 'sitemap.xml']

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
    // A locale already in the path is the visitor's choice and is honoured as-is, for
    // people and crawlers alike. It used to be overridden with DEFAULT_LOCALE for humans
    // while bots kept the URL locale, so `/en/about` answered 200 to Googlebot and 302 to
    // everybody else. `sitemap.xml.ts` advertises an `hreflang="en"` alternate for every
    // URL, and Google's rule for those is that the target must not redirect — indexing
    // `/en/*` while sending readers to `/ua/*` made the English alternates worthless and
    // risked the whole hreflang set being ignored. One rule for every user agent is what
    // makes the advertised alternates real.
    if (!pathHasLocale) {
      return navigateTo({ path: `/${DEFAULT_LOCALE}${to.path}`, query: to.query, hash: to.hash }, { redirectCode: 302 })
    }

    return
  }

  // No `default` here, and that is load-bearing. Nuxt materializes a cookie default as a
  // real write — `Set-Cookie` on the server, `document.cookie` on the client — so a default
  // of `ua` recorded "this visitor prefers Ukrainian" the very first time they loaded
  // `/en/*`, and every navigation after that took the cookie branch below and sent them
  // back. Absence of the cookie means "no preference", which the fallback in `targetLocale`
  // already supplies without storing anything.
  const localeCookie = useCookie<string>('locale', {
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
    // Same rule as the server-side cookies (server/utils/oauth.ts): dev serves plain HTTP.
    secure: !import.meta.dev,
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
