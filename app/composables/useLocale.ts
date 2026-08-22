import { useState, useRoute, useRouter } from '#app'
import ua from '~/locales/ua.json'
import en from '~/locales/en.json'

export type Locale = 'ua' | 'en'
type LocaleMessages = typeof ua

const messages: Record<Locale, LocaleMessages> = { ua, en }
const DEFAULT_LOCALE: Locale = 'ua'

export const useLocale = () => {
  const route = useRoute()
  const router = useRouter()

  const pathSegments = route.path.split('/').filter(Boolean)
  const currentPathLocale = (pathSegments[0] && messages[pathSegments[0] as Locale])
    ? (pathSegments[0] as Locale)
    : DEFAULT_LOCALE

  const locale = useState<Locale>('locale', () => currentPathLocale)

  const getNestedValue = (obj: any, path: string): string => {
    return path.split('.').reduce((acc: any, key: string) => acc?.[key], obj) || path
  }

  const t = (key: string, params?: Record<string, any>): string => {
    const value = getNestedValue(messages[locale.value], key)

    if (params) {
      return Object.entries(params).reduce(
        (acc: string, [k, v]: [string, any]) => acc.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v)),
        value,
      )
    }

    return value
  }

  const setLocale = (target: Locale) => {
    if (locale.value === target) return

    locale.value = target

    // 1. Сначала обновляем куку
    const localeCookie = useCookie<string>('locale', {
      default: () => DEFAULT_LOCALE,
      maxAge: 60 * 60 * 24 * 365,
      sameSite: 'lax',
      path: '/',
    })
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

  return { t, locale, setLocale }
}
