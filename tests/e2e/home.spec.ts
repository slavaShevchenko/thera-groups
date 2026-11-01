import { expect, test } from './helpers/fixtures'
import { t } from './helpers/text'

test.describe('home page', () => {
  test('a failed latest-groups load offers a retry that recovers it', async ({ page }) => {
    // SSR calls its own handlers in-process, which Playwright cannot intercept, so the
    // failure has to land on a client-side navigation into the page instead.
    await page.goto('/ua/catalog')

    // `useFetch` retries a failed call once on its own, so the fault has to be held until
    // the retry button is clicked rather than dropped after the first attempt.
    let failing = true
    await page.route('**/api/groups/latest', route =>
      failing ? route.abort('failed') : route.continue())

    // The footer repeats the logo, so the click is aimed at the banner only.
    await page.getByRole('banner').locator('.ui-logo').click()
    await expect(page).toHaveURL(/\/ua\/?$/)

    const failure = page.locator('.home-page__error')

    await expect(failure).toBeVisible()
    await expect(failure).toContainText(t('common.errors.fetchFailed'))

    failing = false
    await failure.getByRole('button', { name: t('common.retry') }).click()

    await expect(failure).toBeHidden()
    await expect(page.locator('.group-section')).toBeVisible()
  })
})
