import { expect, test } from './helpers/fixtures'
import { t } from './helpers/text'

const searchLabel = t('organizers.searchPlaceholder')

test.describe('organizers', () => {
  test('renders heading, search field and result counter', async ({ page }) => {
    await page.goto('/ua/organizers')

    await expect(page.getByRole('heading', { level: 1 })).toHaveText(t('common.organizers'))
    await expect(page.getByLabel(searchLabel)).toBeVisible()
    // Scoped by class: useHead also renders a role="status" live region for the title.
    await expect(page.locator('.organizers-page__count')).toHaveText(
      new RegExp(t('organizers.found', { count: '\\d+' })),
    )
  })

  test('debounces typing into the URL query', async ({ page }) => {
    await page.goto('/ua/organizers')

    await page.getByLabel(searchLabel).fill('Іван')

    await expect(page).toHaveURL(new RegExp(`q=${encodeURIComponent('Іван')}`))
  })

  test('restores the search term from the URL after a reload', async ({ page }) => {
    await page.goto(`/ua/organizers?q=${encodeURIComponent('Іван')}`)

    await expect(page.getByLabel(searchLabel)).toHaveValue('Іван')
    await expect(page).toHaveURL(new RegExp(`q=${encodeURIComponent('Іван')}`))
  })

  test('empty state offers a clear-search action that drops the query', async ({ page }) => {
    await page.goto('/ua/organizers?q=e2e-no-such-organizer')

    await expect(page.getByText(t('organizers.noResults'))).toBeVisible()

    await page.getByRole('button', { name: t('common.clearSearch') }).click()

    await expect(page).toHaveURL(/\/ua\/organizers$/)
    await expect(page.getByLabel(searchLabel)).toHaveValue('')
  })
})
