import type { BrowserContext } from '@playwright/test'

export type Locale = 'ua' | 'en'

// app/middleware/locale.global.ts ranks cookie > URL > default, so a browser without
// the cookie is redirected from /en/* to /ua/*. Set it to reach English pages.
export async function setLocaleCookie(context: BrowserContext, locale: Locale): Promise<void> {
  await context.addCookies([
    {
      name: 'locale',
      value: locale,
      domain: 'localhost',
      path: '/',
    },
  ])
}
