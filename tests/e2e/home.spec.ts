import { expect, test } from './helpers/fixtures'
import { t } from './helpers/text'

interface ArticleTeaser {
  slug: string
  title: string
  publishedDate: string
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

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

  /**
   * The block exists for its links, so the assertion is on real `href`s in the served HTML
   * and on where the first one lands — not on the block merely being visible. Compared
   * against the endpoint rather than against a hardcoded list: the archive is real data and
   * changes whenever an admin publishes something.
   */
  test('the latest-articles block links into the archive', async ({ page }) => {
    const response = await page.request.get('/api/articles/latest', { params: { locale: 'ua' } })
    const teasers = await response.json() as ArticleTeaser[]
    if (teasers.length === 0) {
      test.skip(true, 'no published article to list')
      return
    }

    await page.goto('/ua')

    const block = page.locator('.home-articles')
    await expect(block.getByRole('heading', { level: 2 })).toHaveText(t('pages.home.articles.title'))
    await expect(block.locator('.home-articles__card')).toHaveCount(teasers.length)

    const first = block.locator('.home-articles__card-link').first()
    await expect(first).toHaveText(teasers[0].title)
    await expect(first).toHaveAttribute('href', `/ua/articles/${teasers[0].slug}`)
    // A date rendered through `formatSiteDay`, so the machine-readable one is the bare day.
    await expect(block.locator('.home-articles__date').first())
      .toHaveAttribute('datetime', teasers[0].publishedDate)

    await first.click()

    await expect(page).toHaveURL(new RegExp(`/ua/articles/${escapeRegExp(teasers[0].slug)}$`))
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(teasers[0].title)
  })

  /**
   * An empty archive hides the whole section, the way the latest-events block above it does:
   * a heading with nothing under it reads as a broken page. Stubbed on a client-side
   * navigation because SSR calls its own handlers in-process, where Playwright cannot
   * intercept — the same reason the retry test above starts from `/catalog`.
   */
  test('an archive with nothing published hides the block', async ({ page }) => {
    await page.goto('/ua/catalog')
    await page.route('**/api/articles/latest**', route => route.fulfill({ json: [] }))

    await page.getByRole('banner').locator('.ui-logo').click()
    await expect(page).toHaveURL(/\/ua\/?$/)

    await expect(page.locator('.home-articles')).toBeHidden()
    // The rest of the page is not collateral damage.
    await expect(page.locator('.how-it-works')).toBeVisible()
  })
})
