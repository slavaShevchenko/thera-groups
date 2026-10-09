import { expect, test } from './helpers/fixtures'

/**
 * What a crawler and a browser are told about the site. Every request here is a read, so
 * the specs run against whatever `DATABASE_URL` the dev server points at.
 */
test.describe('crawler-facing surfaces', () => {
  test('sitemap lists the catalog but not the legal pages awaiting review', async ({ request }) => {
    const response = await request.get('/sitemap.xml')

    expect(response.ok()).toBeTruthy()

    const xml = await response.text()

    expect(xml).toContain('/ua/catalog')
    expect(xml).not.toContain('/privacy')
    expect(xml).not.toContain('/terms')
  })

  test('robots.txt leaves the legal pages crawlable, so their noindex tag can be read', async ({ request }) => {
    const response = await request.get('/robots.txt')

    expect(response.ok()).toBeTruthy()

    const body = await response.text()

    // A Disallow here would defeat the meta tag: a crawler refused the page never sees it.
    expect(body).not.toContain('privacy')
    expect(body).not.toContain('terms')
    expect(body).toContain('Sitemap: ')
  })

  for (const slug of ['privacy', 'terms']) {
    test(`/ua/${slug} asks not to be indexed while the copy is unreviewed`, async ({ page }) => {
      await page.goto(`/ua/${slug}`)

      await expect(page.locator('meta[name="robots"]'))
        .toHaveAttribute('content', 'noindex, nofollow')
    })
  }

  test('HSTS starts at five minutes and the framework banner is not sent', async ({ page }) => {
    const response = await page.goto('/ua')
    const headers = response?.headers() ?? {}

    // Raised deliberately, one step at a time — see docs/deployment.md.
    expect(headers['strict-transport-security']).toBe('max-age=300')
    expect(headers['x-powered-by']).toBeUndefined()
  })
})
