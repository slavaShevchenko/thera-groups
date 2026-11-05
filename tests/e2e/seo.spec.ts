import { expect, test } from './helpers/fixtures'
import { t } from './helpers/text'
import { GROUP_TYPES } from '../../shared/constants/groupTypes'
import type { Page } from '@playwright/test'

interface JsonLdNode {
  '@type'?: string
  'itemListElement'?: { name?: string, item?: string }[]
}

/** The `item` of every step in the head's BreadcrumbList, in order. */
async function breadcrumbTrail(page: Page): Promise<string[]> {
  const scripts = await page.locator('script[type="application/ld+json"]').allTextContents()

  for (const script of scripts) {
    const node = JSON.parse(script) as JsonLdNode
    if (node['@type'] === 'BreadcrumbList') {
      return (node.itemListElement ?? []).map(step => step.item ?? '')
    }
  }

  return []
}

/**
 * What a crawler and a browser are told about the site. Every request here is a read, so
 * the specs run against whatever `DATABASE_URL` the dev server points at.
 */
test.describe('crawler-facing surfaces', () => {
  test('the breadcrumb trail in the head follows an SPA navigation', async ({ page }) => {
    await page.goto('/ua/catalog')

    const catalogTrail = await breadcrumbTrail(page)

    // Absolute, and built from SITE_URL: the last step carries no `path` of its own, so
    // an empty `item` here would mean the current route was not substituted for it.
    expect(catalogTrail.every(item => item.startsWith('http'))).toBeTruthy()
    expect(catalogTrail.at(-1)).toContain('/ua/catalog')

    // A client-side navigation on purpose. The layout keeps one <AppBreadcrumbs> instance
    // across routes, which is exactly what froze the trail on the first page rendered.
    await page.getByRole('banner')
      .getByRole('link', { name: t('common.organizers'), exact: true })
      .click()
    await expect(page).toHaveURL(/\/ua\/organizers$/)

    await expect
      .poll(() => breadcrumbTrail(page).then(trail => trail.at(-1)))
      .toContain('/ua/organizers')

    expect(await breadcrumbTrail(page)).not.toEqual(catalogTrail)
  })

  test('sitemap lists the catalog but not the legal pages awaiting review', async ({ request }) => {
    const response = await request.get('/sitemap.xml')

    expect(response.ok()).toBeTruthy()

    const xml = await response.text()

    expect(xml).toContain('/ua/catalog')
    expect(xml).not.toContain('/privacy')
    expect(xml).not.toContain('/terms')
  })

  test('sitemap lists every category, not only the ones that already have a group', async ({ request }) => {
    const response = await request.get('/sitemap.xml')

    expect(response.ok()).toBeTruthy()

    const xml = await response.text()

    // Compared on the path, not the absolute URL: `<loc>` is built from SITE_URL, which is
    // the deployment's own origin and not the dev server the specs run against.
    const listed = new Set(
      [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(([, loc]) => new URL(loc).pathname),
    )

    // A category page is a landing page: it answers 200 with its own title and description
    // whether or not any group of that type exists yet, so gating the sitemap on inventory
    // hid sixteen of the seventeen for as long as the catalog was still filling up.
    for (const { slug } of GROUP_TYPES) {
      for (const locale of ['ua', 'en']) {
        expect(listed, `${locale}/catalog/${slug}`).toContain(`/${locale}/catalog/${slug}`)
      }
    }
  })

  test('the catalog links to every category with a real anchor, so a crawler can follow it', async ({ page }) => {
    await page.goto('/ua/catalog')

    // The type picker is a <select> that navigates through router.push, which renders no
    // href at all. Without these links the sitemap is the only way in, and a category the
    // sitemap misses is unreachable.
    for (const { slug } of GROUP_TYPES) {
      await expect(
        page.locator(`a[href="/ua/catalog/${slug}"]`).first(),
        slug,
      ).toBeVisible()
    }
  })

  test('a category page marks itself current and links to its siblings', async ({ page }) => {
    await page.goto('/ua/catalog/conference')

    // Scoped to the nav: RouterLink also puts aria-current="page" on any other exactly-active
    // link in the header, which would make an unscoped locator ambiguous.
    const current = page.locator('.category-links__link[aria-current="page"]')

    await expect(current).toHaveAttribute('href', '/ua/catalog/conference')

    // Sibling links are what let a crawler reach the other sixteen from any one of them.
    await expect(page.locator('a[href="/ua/catalog/symposium"]')).toBeVisible()
    await expect(page.locator('.category-links a[href="/ua/catalog"]')).toBeVisible()
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
