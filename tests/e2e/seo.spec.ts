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

  test('sitemap lists the catalog and the legal pages in both locales', async ({ request }) => {
    const response = await request.get('/sitemap.xml')

    expect(response.ok()).toBeTruthy()

    const xml = await response.text()

    // Compared on the path, not the absolute URL: `<loc>` is built from SITE_URL, which is
    // the deployment's own origin and not the dev server the specs run against.
    const listed = new Set(
      [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(([, loc]) => new URL(loc).pathname),
    )

    // The terms and the privacy policy are published legal documents, not drafts awaiting
    // review, so they are indexable — and a page that asks to be indexed while the sitemap
    // hides it is a page no crawler is ever pointed at.
    for (const path of ['/catalog', '/privacy', '/terms']) {
      for (const locale of ['ua', 'en']) {
        expect(listed, `${locale}${path}`).toContain(`/${locale}${path}`)
      }
    }
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

  test('robots.txt leaves the legal pages crawlable', async ({ request }) => {
    const response = await request.get('/robots.txt')

    expect(response.ok()).toBeTruthy()

    const body = await response.text()

    // A Disallow here would hide a published legal document the sitemap advertises: a
    // crawler refused the page never reads it, whatever its meta tag says.
    expect(body).not.toContain('privacy')
    expect(body).not.toContain('terms')
    expect(body).toContain('Sitemap: ')
  })

  test('a group page advertises the type its structured data actually is', async ({ page, request }) => {
    const response = await request.get('/api/groups', { params: { limit: '1' } })
    const body = await response.json() as { groups: { slug: string }[] }

    if (body.groups.length === 0) {
      test.skip(true, 'the catalog holds no published group to read the head of')
      return
    }

    await page.goto(`/ua/groups/${body.groups[0]!.slug}`)

    // The `website` default of `useSeoPage`, left alone on purpose. This page's JSON-LD is an
    // `Event`; `og:type: article` was what made a crawler classify it as an article and then
    // report the missing `Article` markup — headline, author, datePublished — that an event
    // page has no honest values for.
    await expect(page.locator('meta[property="og:type"]')).toHaveAttribute('content', 'website')
  })

  for (const slug of ['privacy', 'terms']) {
    test(`/ua/${slug} is indexable, like every other public page`, async ({ page }) => {
      await page.goto(`/ua/${slug}`)

      // `useSeoPage` defaults to 'index, follow' and only a private surface overrides it.
      // These two are the documents the site tells a visitor govern them, so they have to be
      // findable — the copy was reviewed and rewritten as a real policy on 2026-11-16, which
      // is what retired the temporary noindex it carried before.
      await expect(page.locator('meta[name="robots"]'))
        .toHaveAttribute('content', 'index, follow')
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
