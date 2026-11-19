import type { APIRequestContext } from '@playwright/test'
import { expect, test } from './helpers/fixtures'
import type { Locale } from './helpers/locale'
import { t, tEn } from './helpers/text'

interface ArticlesResponse {
  articles: { slug: string, title: string }[]
}

async function titlesBySlug(request: APIRequestContext, locale: Locale): Promise<Map<string, string>> {
  // Playwright spells query parameters `params`; the `query` name that $fetch uses is silently
  // ignored here, which leaves the server on its `ua` default.
  const response = await request.get('/api/articles', { params: { locale } })
  const body = await response.json() as ArticlesResponse
  return new Map(body.articles.map(article => [article.slug, article.title]))
}

/**
 * An article that is published in both languages, or null.
 *
 * The archive is real data, so a bilingual pair cannot be assumed. Titles that read the same
 * in both languages are skipped over: an assertion that passes whether or not the page
 * switched is not a test of anything.
 */
async function findBilingualArticle(request: APIRequestContext) {
  const [ua, en] = await Promise.all([titlesBySlug(request, 'ua'), titlesBySlug(request, 'en')])

  for (const [slug, uaTitle] of ua) {
    const enTitle = en.get(slug)
    if (enTitle && enTitle !== uaTitle) return { slug, uaTitle, enTitle }
  }

  return null
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

test.describe('articles', () => {
  test('an article follows the language switch', async ({ page }) => {
    const article = await findBilingualArticle(page.request)
    if (!article) {
      test.skip(true, 'no published article carries two different translations')
      return
    }

    await page.goto(`/ua/articles/${article.slug}`)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(article.uaTitle)

    await page.getByRole('button', { name: t('layout.header.switchLanguage') }).click()

    await expect(page).toHaveURL(new RegExp(`/en/articles/${escapeRegExp(article.slug)}$`))
    // The regression this guards. The switch fetched the English article and wrote it into the
    // payload, yet the page kept rendering the Ukrainian one: both languages shared a single
    // asyncData key, and Nuxt reuses the live entry registered under a key it has already seen
    // instead of reading the payload again.
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(article.enTitle)
    await expect(page).toHaveTitle(new RegExp(`^${escapeRegExp(article.enTitle)} \\| `))

    await page.getByRole('button', { name: tEn('layout.header.switchLanguage') }).click()

    await expect(page).toHaveURL(new RegExp(`/ua/articles/${escapeRegExp(article.slug)}$`))
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(article.uaTitle)
  })

  test('the article list follows the language switch', async ({ page }) => {
    const [ua, en] = await Promise.all([
      titlesBySlug(page.request, 'ua'),
      titlesBySlug(page.request, 'en'),
    ])
    const enTitles = new Set(en.values())
    // Nothing to prove when every article reads the same in both languages.
    if (enTitles.size === 0 || [...ua.values()].every(title => enTitles.has(title))) {
      test.skip(true, 'the archive reads the same in both languages')
      return
    }

    await page.goto('/ua/articles')
    await page.getByRole('button', { name: t('layout.header.switchLanguage') }).click()

    // Polled rather than read once: the URL is rewritten before the English list resolves, and
    // a single read in that window would still see the Ukrainian cards.
    await expect
      .poll(async () => {
        const titles = await page.locator('.article-card__title').allTextContents()
        return titles.length > 0 && titles.every(title => enTitles.has(title))
      })
      .toBe(true)

    await expect(page).toHaveURL(/\/en\/articles$/)
  })
})
