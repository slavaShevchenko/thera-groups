// Google Consent Mode v2 — gtag function declared in nuxt.config.ts inline script
declare function gtag(_command: 'consent', _action: 'default' | 'update', _params: Record<string, string>): void

interface Window {
  gtag?: typeof gtag
  dataLayer?: unknown[]
}
