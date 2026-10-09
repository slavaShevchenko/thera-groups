import type { Locale } from '~~/types'

const LOCALES: readonly Locale[] = ['ua', 'en']
const DEFAULT_LOCALE: Locale = 'ua'
const LOCALE_PREFIX = /^\/(?:ua|en)(?=\/|$)/

// Exact routes that require a session, plus prefixes for the parameterised ones.
// Prefixes end with '/' so '/groups/new' can never match a published group whose slug
// happens to start with 'new'.
const PRIVATE_PATHS = new Set([
  '/admin',
  '/applications/my',
  '/favorites',
  '/groups/my',
  '/groups/new',
  '/notifications',
  '/profile',
])

const PRIVATE_PREFIXES = [
  '/admin/',
  '/groups/applications/',
  '/groups/edit/',
  '/profile/',
]

// Global middleware runs in filename order, so this executes before locale.global.ts and
// can see a path that has no locale prefix yet. Stripping it makes the guard order-independent.
function withoutLocale(path: string): string {
  const stripped = path.replace(LOCALE_PREFIX, '')
  return stripped === '' ? '/' : stripped
}

function isPrivate(path: string): boolean {
  return PRIVATE_PATHS.has(path) || PRIVATE_PREFIXES.some(prefix => path.startsWith(prefix))
}

function isAdminArea(path: string): boolean {
  return path === '/admin' || path.startsWith('/admin/')
}

// Same priority as locale.global.ts (cookie > URL > default), so the redirect target is
// one the locale guard accepts instead of triggering a second bounce.
function localeOf(path: string): Locale {
  const cookie = useCookie<string>('locale').value
  if (LOCALES.includes(cookie as Locale)) return cookie as Locale

  const segment = path.split('/')[1]
  if (LOCALES.includes(segment as Locale)) return segment as Locale

  return DEFAULT_LOCALE
}

export default defineNuxtRouteMiddleware(async (to) => {
  const { user, isAuthenticated, fetchUser } = useUser()

  // The auth plugin normally settles the session before the router runs. Awaiting the
  // deduplicated promise keeps this guard correct on its own, and costs nothing once
  // the session is resolved.
  await fetchUser()

  const path = withoutLocale(to.path)
  if (!isPrivate(path)) return

  if (!isAuthenticated.value) {
    // returnTo is echoed into the login URL and re-validated there before it is followed,
    // so a crafted link cannot turn the post-login redirect into an open redirect.
    return navigateTo({
      path: `/${localeOf(to.path)}/auth/login`,
      query: { returnTo: to.fullPath },
    }, { redirectCode: 302 })
  }

  // Signed in but not an admin. Sent home rather than shown a 403 — this is the panel's
  // existing behaviour, and every admin API still enforces the role server-side.
  if (isAdminArea(path) && user.value?.role !== 'ADMIN') {
    return navigateTo(`/${localeOf(to.path)}/`)
  }
})
