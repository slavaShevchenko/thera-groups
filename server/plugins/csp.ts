export default defineNitroPlugin((nitro) => {
  nitro.hooks.hook('render:response', (response) => {
    if (process.env.NODE_ENV !== 'production') return

    const headers = response.headers as Record<string, string> | undefined
    if (!headers) return

    const contentType = headers['content-type'] ?? ''
    if (!contentType.startsWith('text/html')) return

    const directives = [
      `default-src 'self'`,
      `script-src 'self' 'unsafe-inline'`,
      `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`,
      `img-src 'self' data: blob: https:`,
      `font-src 'self' https://fonts.gstatic.com`,
      `connect-src 'self' https://*.supabase.co https://api.resend.com https://*.googleapis.com https://*.google.com`,
      `frame-ancestors 'none'`,
      `base-uri 'self'`,
      `form-action 'self'`,
    ]

    headers['Content-Security-Policy'] = directives.join('; ')
  })
})
