import { expect, test } from './helpers/fixtures'
import { t } from './helpers/text'

const filters = '.group-filters'
const typeSelect = '.group-filters__type-select select'
const dateInput = '.group-filters__input--date'
const languagePicker = '.language-picker'
const languagePills = '.language-picker__pill'

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

  test('the language filter is on the catalog and not on the home page', async ({ page }) => {
    // The home bar carries no `live`, and that prop is what keeps this field catalog-only.
    await page.goto('/ua')
    await expect(page.locator(languagePicker)).toHaveCount(0)

    await page.goto('/ua/catalog')
    await expect(page.locator(languagePicker)).toHaveCount(1)
    await expect(page.locator('#filters-languages-label')).toHaveText(t('common.languages'))
    await expect(page.locator(`${languagePicker} input`)).toHaveAttribute(
      'placeholder',
      t('filters.languagesPlaceholder'),
    )
  })

  test('picking a language writes languages into the URL query and refetches with it', async ({ page }) => {
    const apiSearches: string[] = []
    page.on('request', (request) => {
      const url = new URL(request.url())
      if (url.pathname === '/api/groups') apiSearches.push(url.search)
    })

    await page.goto('/ua/catalog')

    const search = page.locator(languagePicker).getByRole('combobox')
    await search.fill('укр')

    const option = page.locator(`${languagePicker} [role="option"]`, { hasText: 'Українська' }).first()
    await expect(option).toBeVisible()
    await option.click()

    await expect(page).toHaveURL(/languages=uk/)
    await expect(page.locator(languagePills)).toContainText(['Українська'])
    // The picker clears its own query after a selection, so the next search starts fresh.
    await expect(search).toHaveValue('')

    // Only the refetch is visible from the browser — the first request ran during SSR.
    await expect
      .poll(() => apiSearches.some(value => value.includes('languages=uk')))
      .toBe(true)
  })

  test('removing the last language drops the param instead of sending an empty one', async ({ page }) => {
    await page.goto('/ua/catalog?languages=uk')

    await expect(page.locator(languagePills)).toHaveCount(1)
    await page.locator(languagePills).getByRole('button').click()

    await expect(page.locator(languagePills)).toHaveCount(0)
    await expect(page).toHaveURL(/\/ua\/catalog$/)
  })

  test('a languages query rehydrates the picker from one comma-separated param', async ({ page }) => {
    await page.goto('/ua/catalog?languages=uk,es')

    // The URL is the source of truth on a fresh load, so both pills come back with it and in
    // its order — a bookmarked or shared filtered catalog has to look the way it was left.
    await expect(page.locator(languagePills)).toHaveCount(2)
    await expect(page.locator(languagePills)).toContainText(['Українська', 'Español'])
  })

  test('a language no group runs in narrows the catalog to nothing', async ({ page }) => {
    await page.goto('/ua/catalog')

    const cardCount = await page.locator('.catalog-list__grid > *').count()
    test.skip(cardCount === 0, 'the catalog this suite points at has no published group to filter away')

    // `zu` is a valid ISO 639-1 code, so it passes validation and reaches the query — it
    // just matches no row, which is the point.
    await page.goto('/ua/catalog?languages=zu')

    const empty = page.locator('.ui-empty-state')
    await expect(empty).toBeVisible()
    await expect(empty).toContainText(t('common.noResults'))
  })

  test('reset filters clears the query string', async ({ page }) => {
    await page.goto('/ua/catalog?format=ONLINE')

    await page.locator(filters).getByRole('button', { name: t('filters.reset') }).click()

    await expect(page).toHaveURL(/\/ua\/catalog$/)
  })

  test('a search with no matches explains itself and offers a way back', async ({ page }) => {
    await page.goto('/ua/catalog?q=e2e-no-such-group')

    const empty = page.locator('.ui-empty-state')

    await expect(empty).toBeVisible()
    await expect(empty).toContainText(t('common.noResults'))
    await expect(empty).toContainText(t('filters.noResultsHint'))

    await empty.getByRole('button', { name: t('filters.reset') }).click()

    await expect(page).toHaveURL(/\/ua\/catalog$/)
    // Asserted on the list root, not on `.ui-empty-state`: after the reset the catalog
    // either lists groups or shows its own "none yet" state depending on the database
    // this suite is pointed at, so the only stable claim is that the dead end is gone
    // without a reload.
    await expect(page.locator('.catalog-list')).not.toContainText(t('common.noResults'))
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
