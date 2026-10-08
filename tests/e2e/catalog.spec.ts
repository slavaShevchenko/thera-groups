import { expect, test } from './helpers/fixtures'
import { t } from './helpers/text'

const filters = '.group-filters'
const typeSelect = '.group-filters__type-select select'
const dateInput = '.group-filters__input--date'

test.describe('catalog', () => {
  test('renders heading, filter bar and live result counter', async ({ page }) => {
    await page.goto('/ua/catalog')

    await expect(page.getByRole('heading', { level: 1 })).toHaveText(t('pages.catalog.title'))
    await expect(page.locator(filters).getByRole('searchbox')).toBeVisible()
    await expect(page.locator(typeSelect)).toBeVisible()
    await expect(page.locator('.group-filters__live-count')).toContainText(t('filters.found'))
  })

  test('selecting a group type navigates to its catalog page', async ({ page }) => {
    await page.goto('/ua/catalog')

    await page.locator(typeSelect).selectOption('INTERVISION')

    await expect(page).toHaveURL(/\/ua\/catalog\/intervision$/)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(t('groupTypes.INTERVISION'))
  })

  test('debounces the search field into the URL query', async ({ page }) => {
    await page.goto('/ua/catalog')

    await page.locator(filters).getByRole('searchbox').fill('група')

    await expect(page).toHaveURL(new RegExp(`q=${encodeURIComponent('група')}`))
  })

  test('format segment marks the active button and filters by format', async ({ page }) => {
    await page.goto('/ua/catalog')
    const online = page.locator(filters).getByRole('button', {
      name: t('common.formats.online'),
      exact: true,
    })

    await online.click()

    await expect(page).toHaveURL(/format=ONLINE/)
    await expect(online).toHaveClass(/group-filters__segment-btn--active/)
  })

  test('date filter writes dateFrom into the URL query', async ({ page }) => {
    await page.goto('/ua/catalog')

    await page.locator(filters).getByLabel(t('filters.dateFromLabel')).fill('2026-12-01')

    await expect(page).toHaveURL(/dateFrom=2026-12-01/)
  })

  // showPicker() needs transient user activation and opens a native popup that cannot
  // be driven headlessly, so this only asserts the handler's catch/focus fallback.
  test('clicking the date filter keeps the page usable', async ({ page }) => {
    const pageErrors: string[] = []
    page.on('pageerror', error => pageErrors.push(error.message))

    await page.goto('/ua/catalog')
    const date = page.locator(`${filters} ${dateInput}`)

    await date.click()
    await expect(date).toBeFocused()
    expect(pageErrors).toEqual([])
  })

  test('reset filters clears the query string', async ({ page }) => {
    await page.goto('/ua/catalog?format=ONLINE')

    await page.locator(filters).getByRole('button', { name: t('filters.reset') }).click()

    await expect(page).toHaveURL(/\/ua\/catalog$/)
  })

  test('unknown catalog type responds with 404', async ({ page }) => {
    const response = await page.goto('/ua/catalog/not-a-real-type')

    expect(response?.status()).toBe(404)
  })

  // The retired slugs used to answer with a 301 from catalogTypeRedirect middleware.
  // With no pre-consolidation URLs left to preserve they fall through to the page's 404.
  test('retired catalog slugs respond with 404 instead of redirecting', async ({ page }) => {
    for (const slug of ['foundation', 'advanced', 'professional', 'partnership', 'international']) {
      const response = await page.goto(`/ua/catalog/${slug}`)

      expect(response?.status()).toBe(404)
      expect(page.url()).toContain(`/ua/catalog/${slug}`)
    }
  })
})
