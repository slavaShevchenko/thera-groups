// Google Consent Mode v2 — gtag function declared in nuxt.config.ts inline script
declare function gtag(_command: 'consent', _action: 'default' | 'update', _params: Record<string, string>): void

// Cloudflare Turnstile — invisible captcha widget
interface TurnstileOptions {
  'sitekey': string
  'theme'?: 'light' | 'dark' | 'auto'
  'callback'?: (_token: string) => void
  'expired-callback'?: () => void
  'error-callback'?: () => void
}

interface Turnstile {
  render: (_container: HTMLElement, _options: TurnstileOptions) => string
  remove: (_widgetId: string) => void
  reset: (_widgetId?: string) => void
}

interface Window {
  gtag?: typeof gtag
  dataLayer?: unknown[]
  turnstile?: Turnstile
}
