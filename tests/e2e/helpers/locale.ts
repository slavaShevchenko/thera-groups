import type { BrowserContext } from '@playwright/test'

export type Locale = 'ua' | 'en'

// app/middleware/locale.global.ts ranks cookie > URL > default. The cookie therefore only
// matters when it disagrees with the path: an unlocaled URL takes the default, a URL that
// already carries a valid locale is served as it stands, and a set cookie rewrites the
// path to match it. Use this to simulate a returning visitor who picked a language.
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
