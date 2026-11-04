import { expect, test } from './helpers/fixtures'
import { t, tEn } from './helpers/text'

// `app/error.vue` replaces the whole app tree, so nothing else on the page can vouch for it:
// the copy, the language and the way out are all decided inside the component. All three were
// wrong at once — the message came from `statusCode` alone, the palette was hardcoded off-brand
// hex, and "Go home" pointed at `/`, whose route rule sends an English reader to the Ukrainian
// site. An unmatched route needs no database and no session, which is what makes it usable here.
test.describe('error page', () => {
  test('renders an unmatched /en/* route in English and offers an English way home', async ({ page }) => {
    await page.goto('/en/this-route-does-not-exist')

    await expect(page.locator('.error-page__code')).toHaveText('404')
    await expect(page.locator('.error-page__message')).toHaveText(tEn('errors.notFound'))
    // Set by error.vue itself: the `useLocaleHead()` call in app.vue never runs once the error
    // page has replaced the tree, so without it the tab stays on the nuxt.config default.
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
    await expect(page).toHaveTitle(new RegExp(tEn('errors.notFound')))

    await page.getByRole('button', { name: tEn('common.goHome') }).click()

    // The home page then forwards to the catalog, so only the locale segment is asserted.
    await expect(page).toHaveURL(/\/en(\/|$)/)
  })

  test('shows the reason a page chose instead of a generic 404', async ({ page }) => {
    // `organizers/[slug].vue` names its own failure with `data: { code: 'ORGANIZER_NOT_FOUND' }`
    // — the only channel `error.vue` renders specific copy through, because `statusMessage` is
    // where the router and the API put their own English text.
    await page.goto('/en/organizers/not-a-real-organizer')

    await expect(page.locator('.error-page__code')).toHaveText('404')
    await expect(page.locator('.error-page__message')).toHaveText(tEn('organizer.profile.notFound'))
  })

  test('answers a 404 in the default locale for a path with no locale segment', async ({ page }) => {
    await page.goto('/this-route-does-not-exist')

    // `locale.global.ts` sends an unlocaled path to `/ua/*`, which then matches nothing. What
    // the reader must not see is Nuxt's own `statusMessage` for an unmatched route —
    // `Page not found: <path>` — which is English and echoes the requested URL back.
    await expect(page).toHaveURL(/\/ua\/this-route-does-not-exist$/)
    await expect(page.locator('.error-page__message')).toHaveText(t('errors.notFound'))
    await expect(page.locator('html')).toHaveAttribute('lang', 'uk')
  })

  test('takes its colours from the design tokens', async ({ page }) => {
    await page.goto('/ua/this-route-does-not-exist')

    // Compared against the live custom properties rather than literal rgb values, so
    // retheming does not break the test while going back to a hardcoded hex does.
    const colours = await page.evaluate(() => {
      // A custom property resolves to a token, not a colour, so it is read back through a
      // probe element that the browser has actually computed.
      const resolve = (variable: string) => {
        const probe = document.createElement('span')
        probe.style.color = getComputedStyle(document.documentElement).getPropertyValue(variable)
        document.body.append(probe)
        const value = getComputedStyle(probe).color
        probe.remove()
        return value
      }

      const colourOf = (selector: string) => {
        const element = document.querySelector(selector)
        return element ? getComputedStyle(element).color : ''
      }

      return {
        code: colourOf('.error-page__code'),
        message: colourOf('.error-page__message'),
        text: resolve('--color-text'),
        muted: resolve('--color-text-muted'),
      }
    })

    expect(colours.code).toBe(colours.text)
    expect(colours.message).toBe(colours.muted)
  })
})
