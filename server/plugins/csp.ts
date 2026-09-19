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
      `style-src 'self' 'unsafe-inline'`,
      `img-src 'self' data: blob: https://*.supabase.co`,
      `font-src 'self'`,
      `connect-src 'self'`,
      `frame-ancestors 'none'`,
      `base-uri 'self'`,
      `form-action 'self'`,
    ]

    headers['Content-Security-Policy'] = directives.join('; ')
  })
})
