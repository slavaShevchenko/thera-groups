import { useState, useRoute, useRouter } from '#app'
import ua from '~/locales/ua.json'
import en from '~/locales/en.json'
import seoUa from '~/locales/seo.ua.json'
import seoEn from '~/locales/seo.en.json'
import type { Locale } from '~~/types'

export type { Locale } from '~~/types'
type LocaleMessages = typeof ua & typeof seoUa

const messages: Record<Locale, LocaleMessages> = {
  ua: { ...ua, ...seoUa } as LocaleMessages,
  en: { ...en, ...seoEn } as LocaleMessages,
}
const DEFAULT_LOCALE: Locale = 'ua'

export const useLocale = () => {
  const route = useRoute()
  const router = useRouter()

  const pathSegments = route.path.split('/').filter(Boolean)
  const currentPathLocale = (pathSegments[0] && messages[pathSegments[0] as Locale])
    ? (pathSegments[0] as Locale)
    : DEFAULT_LOCALE

  const locale = useState<Locale>('locale', () => currentPathLocale)

  // No `default`: Nuxt writes a cookie default back to the response, so `default: () => 'ua'`
  // here used to hand every first-time visitor of `/en/*` a stored `locale=ua` preference and
  // pin them to Ukrainian from the next navigation on. `locale` is derived from the path
  // above; this ref exists only so `setLocale()` can record an actual choice.
  const localeCookie = useCookie<string>('locale', {
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
    // Same rule as the server-side cookies (server/utils/oauth.ts): dev serves plain HTTP.
    secure: !import.meta.dev,
    path: '/',
  })

  const getNestedValue = (obj: Record<string, unknown>, path: string): unknown => {
    return path.split('.').reduce((acc: unknown, key: string) => (acc as Record<string, unknown>)?.[key], obj)
  }

  const t = (key: string, params?: Record<string, string | number>): string => {
    const raw = getNestedValue(messages[locale.value], key)
    const isMissing = typeof raw !== 'string'
    const value = isMissing ? key : raw

    if (import.meta.dev && isMissing) {
      console.warn(`[i18n] Missing translation key: ${key}`)
    }

    if (params) {
      return Object.entries(params).reduce(
        (acc: string, [k, v]: [string, string | number]) => acc.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v)),
        value,
      )
    }

    return value
  }

  const tRaw = (key: string): unknown => {
    return getNestedValue(messages[locale.value], key)
  }

  const setLocale = (target: Locale) => {
    if (locale.value === target) return

    locale.value = target

    localeCookie.value = target

    // 2. Затем меняем URL
    const segments = route.path.split('/').filter(Boolean)
    if (messages[segments[0] as Locale]) {
      segments[0] = target
    }
    else {
      segments.unshift(target)
    }

    router.replace(`/${segments.join('/')}`)
  }

  return { t, tRaw, locale, setLocale }
}
