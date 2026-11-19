// UiIcon.vue рендерит иконки через @iconify/vue, который догружает недостающие
// наборы с внешнего API в рантайме. Основной хост — api.iconify.design, но
// библиотека при его недоступности уходит на api.simplesvg.com / api.unisvg.com
// (@iconify/vue/dist/iconify.js:631), поэтому разрешены все три: иначе иконки
// снова пропадут в проде в момент деградации основного API.
const iconifyOrigins = 'https://api.iconify.design https://api.simplesvg.com https://api.unisvg.com'

// Ahrefs analytics loads an external script and sends beacon/XHR requests back
// to its origin. Both must be allowed or the browser blocks the script (CSP
// violation) and the analytics silently stop working.
const ahrefsOrigin = 'https://analytics.ahrefs.com'

// Vercel Analytics and Speed Insights load scripts from va.vercel-scripts.com
// and send telemetry to vercel-analytics.com / vercel-speed-insights.com subdomains.
const vercelAnalyticsScript = 'https://va.vercel-scripts.com'
const vercelAnalyticsConnect = 'https://*.vercel-analytics.com https://*.vercel-speed-insights.com'

// Cloudflare Turnstile loads its widget script from challenges.cloudflare.com
// and sends token verification requests to the same origin.
const turnstileOrigin = 'https://challenges.cloudflare.com'

// The browser fetches nothing else. Supabase is reached only from server code
// (server/utils/supabase.ts) and Google OAuth is a full-page navigation, which
// `connect-src` does not govern — both origins used to be listed here and were dead weight.
// A too-wide directive is the one CSP mistake no test suite catches, so it stays narrow.
const connectSrc = `'self' ${iconifyOrigins} ${ahrefsOrigin} ${vercelAnalyticsConnect} ${turnstileOrigin}`

// `'unsafe-inline'` stays on script-src: Nuxt emits inline bootstrap scripts on every SSR
// page and this deployment has no nonce or hash plumbing to replace them with. Removing it
// without that would blank every page — and only in production, where the policy applies.
// `style-src` needs it for the same reason plus Vue's runtime style injection.
const productionDirectives = [
  `default-src 'self'`,
  `script-src 'self' 'unsafe-inline' ${ahrefsOrigin} ${vercelAnalyticsScript} ${turnstileOrigin}`,
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
  `script-src 'self' 'unsafe-inline' 'unsafe-eval' ${ahrefsOrigin} ${vercelAnalyticsScript} ${turnstileOrigin}`,
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
