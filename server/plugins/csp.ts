// UiIcon.vue рендерит иконки через @iconify/vue, который догружает недостающие
// наборы с внешнего API в рантайме. Основной хост — api.iconify.design, но
// библиотека при его недоступности уходит на api.simplesvg.com / api.unisvg.com
// (@iconify/vue/dist/iconify.js:631), поэтому разрешены все три: иначе иконки
// снова пропадут в проде в момент деградации основного API.
const iconifyOrigins = 'https://api.iconify.design https://api.simplesvg.com https://api.unisvg.com'

const connectSrc = `'self' ${iconifyOrigins} https://*.supabase.co https://*.google.com`

const productionDirectives = [
  `default-src 'self'`,
  `script-src 'self' 'unsafe-inline'`,
  `style-src 'self' 'unsafe-inline'`,
  `img-src 'self' data: blob: https:`,
  `font-src 'self'`,
  `connect-src ${connectSrc}`,
  `frame-ancestors 'none'`,
  `base-uri 'self'`,
  `form-action 'self'`,
]

// В dev Nuxt/Vite нужны HMR-websocket, inline-скрипты и eval для sourcemap,
// поэтому политика ослаблена. Origin Iconify присутствует в обоих вариантах.
const developmentDirectives = [
  `default-src 'self'`,
  `script-src 'self' 'unsafe-inline' 'unsafe-eval'`,
  `style-src 'self' 'unsafe-inline'`,
  `img-src 'self' data: blob: https:`,
  `font-src 'self'`,
  `connect-src ${connectSrc} ws: http://localhost:* http://127.0.0.1:*`,
  `frame-ancestors 'none'`,
  `base-uri 'self'`,
  `form-action 'self'`,
]

export default defineNitroPlugin((nitro) => {
  const directives
    = process.env.NODE_ENV === 'production'
      ? productionDirectives
      : developmentDirectives

  const policy = directives.join('; ')

  nitro.hooks.hook('render:response', (response) => {
    const headers = response.headers as Record<string, string> | undefined
    if (!headers) return

    const contentType = headers['content-type'] ?? ''
    if (!contentType.startsWith('text/html')) return

    headers['Content-Security-Policy'] = policy
  })
})
