import { expect, test } from './helpers/fixtures'
import { setLocaleCookie } from './helpers/locale'
import { t, tEn } from './helpers/text'

test.describe('navigation and localization', () => {
  test('redirects the bare root to the default locale', async ({ page }) => {
    await page.goto('/')

    await expect(page).toHaveURL(/\/ua\/?$/)
  })

  test('header links reach the catalog and the organizers page', async ({ page }) => {
    await page.goto('/ua')
    // The footer repeats both links, so navigation is asserted from the banner only.
    const header = page.getByRole('banner')

    await header.getByRole('link', { name: t('drawer.catalog'), exact: true }).click()
    await expect(page).toHaveURL(/\/ua\/catalog$/)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(t('pages.catalog.title'))

    await header.getByRole('link', { name: t('common.organizers'), exact: true }).click()
    await expect(page).toHaveURL(/\/ua\/organizers$/)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(t('common.organizers'))
  })

  test('burger toggles the navigation drawer', async ({ page }) => {
    await page.goto('/ua')
    // The burger's accessible name flips to "close menu" while the drawer is open.
    const burger = page.locator('.app-header__burger')
    const drawer = page.getByRole('dialog', { name: t('drawer.menu') })

    await expect(drawer).toBeHidden()

    await burger.click()
    await expect(drawer).toBeVisible()
    await expect(burger).toHaveAttribute('aria-expanded', 'true')
    await expect(drawer.getByRole('link', { name: t('drawer.catalog') })).toBeVisible()

    await drawer.getByRole('button', { name: t('common.close'), exact: true }).click()
    await expect(drawer).toBeHidden()
    await expect(burger).toHaveAttribute('aria-expanded', 'false')
  })

  test('sign-in and sign-up stay visible in the desktop header', async ({ page }) => {
    // Desktop Chrome's 1280px viewport is the project default, so no resize is needed.
    await page.goto('/ua')

    const auth = page.locator('.app-header__auth')

    await expect(auth.getByRole('link', { name: t('common.login') })).toBeVisible()
    await expect(auth.getByRole('link', { name: t('common.register') })).toBeVisible()
  })

  test('hands sign-in over to the drawer below the desktop breakpoint', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 720 })
    await page.goto('/ua')

    // Hidden rather than absent: on a phone the drawer is what carries both links.
    await expect(page.locator('.app-header__auth')).toBeHidden()

    await page.locator('.app-header__burger').click()

    const drawer = page.getByRole('dialog', { name: t('drawer.menu') })
    await expect(drawer.getByRole('link', { name: t('common.login') })).toBeVisible()
    await expect(drawer.getByRole('link', { name: t('common.register') })).toBeVisible()
  })

  test('language switcher sets the cookie and rewrites the URL', async ({ page, context }) => {
    await page.goto('/ua/catalog')

    await page.getByRole('button', { name: t('layout.header.switchLanguage') }).click()

    await expect(page).toHaveURL(/\/en\/catalog$/)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(tEn('pages.catalog.title'))

    const cookies = await context.cookies()
    expect(cookies.find(cookie => cookie.name === 'locale')?.value).toBe('en')
  })

  test('serves /en/* to a visitor with no locale cookie, without redirecting', async ({ page }) => {
    const response = await page.goto('/en/catalog')

    // The URL alone is not enough: a 302 to /ua/catalog would leave the browser on a
    // different path, but asserting "no redirect happened" is what actually pins the
    // hreflang rule — an advertised alternate must answer 200 at the advertised URL.
    expect(response?.request().redirectedFrom()).toBeNull()
    await expect(page).toHaveURL(/\/en\/catalog$/)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(tEn('pages.catalog.title'))
  })

  test('answers a crawler exactly as it answers a visitor', async ({ page, context }) => {
    // The middleware used to branch on the user agent: Googlebot kept /en/* at 200 while a
    // person was sent to /ua/*. That asymmetry is the bug, so both sides are asserted here
    // rather than the human path alone.
    await context.setExtraHTTPHeaders({
      'user-agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
    })

    const response = await page.goto('/en/catalog')

    expect(response?.request().redirectedFrom()).toBeNull()
    expect(response?.status()).toBe(200)
    await expect(page).toHaveURL(/\/en\/catalog$/)
  })

  test('serves /en/* when the locale cookie is set', async ({ page, context }) => {
    await setLocaleCookie(context, 'en')

    await page.goto('/en/catalog')

    await expect(page).toHaveURL(/\/en\/catalog$/)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(tEn('pages.catalog.title'))
  })
})
