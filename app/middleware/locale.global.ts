export default defineNuxtRouteMiddleware((to) => {
  const locales = ['ua', 'en']
  const defaultLocale = 'ua'

  const pathSegments = to.path.split('/').filter(Boolean)
  const firstSegment = pathSegments[0]

  // Читаем язык из куки (работает и на сервере, и на клиенте)
  const localeCookie = useCookie<string>('locale', {
    default: () => defaultLocale,
    maxAge: 60 * 60 * 24 * 365, // 1 год
    sameSite: 'lax',
    path: '/',
  })

  const targetLocale = locales.includes(localeCookie.value)
    ? localeCookie.value
    : defaultLocale

  // Если первый сегмент пути НЕ совпадает с целевым языком из куки,
  // мы принудительно редиректим на язык из куки, сохраняя остальной путь.
  // Это гарантирует, что выбор пользователя (кука) всегда главнее ссылки.
  if (firstSegment !== targetLocale) {
    const restOfPath = pathSegments.length > 1 ? '/' + pathSegments.slice(1).join('/') : ''
    const newPath = `/${targetLocale}${restOfPath}`

    return navigateTo(newPath, { redirectCode: 302 })
  }
})
