import { describe, it, expect } from 'vitest'
import type { z } from 'zod'
import { ARTICLE_LIMITS } from '../../shared/constants/limits'

import {
  adminArticlesQuerySchema,
  articleLocaleQuerySchema,
  articlesQuerySchema,
  createArticleSchema,
  updateArticleSchema,
} from '../../server/validators/article'

function failedPaths(schema: z.ZodType, payload: unknown): string[] {
  const parsed = schema.safeParse(payload)
  return parsed.success ? [] : parsed.error.issues.map(issue => issue.path.join('.'))
}

function bothTranslations(overrides: Record<string, unknown> = {}) {
  return {
    ua: { title: 'Група підтримки', content: '## Чому це працює' },
    en: { title: 'A support group', content: '## Why it works' },
    ...overrides,
  }
}

describe('createArticleSchema', () => {
  it('accepts an empty body, which is a blank draft', () => {
    const parsed = createArticleSchema.safeParse({})

    expect(parsed.success).toBe(true)
  })

  it('accepts a complete article in both locales', () => {
    const parsed = createArticleSchema.safeParse({
      slug: 'support-group-anxiety',
      status: 'PUBLISHED',
      publishedAt: '2026-11-19',
      authorName: 'Олена Коваль',
      translations: bothTranslations(),
    })

    expect(parsed.success).toBe(true)
  })

  it('trims the title and lowercases the slug', () => {
    const parsed = createArticleSchema.safeParse({
      slug: '  Support-Group  ',
      translations: { ua: { title: '  Назва  ', content: 'Текст' } },
    })

    expect(parsed.success).toBe(true)
    if (!parsed.success) return
    expect(parsed.data.slug).toBe('support-group')
    expect(parsed.data.translations?.ua?.title).toBe('Назва')
  })

  describe('the byline has one source', () => {
    it('refuses an organizer and a free-text name at once', () => {
      const paths = failedPaths(createArticleSchema, {
        authorId: 'profile-1',
        authorName: 'Олена Коваль',
      })

      expect(paths).toEqual(['authorName'])
    })

    it('names the ambiguity in the message rather than a field rule', () => {
      const parsed = createArticleSchema.safeParse({ authorId: 'profile-1', authorName: 'Олена' })

      expect(parsed.success).toBe(false)
      if (parsed.success) return
      expect(parsed.error.issues[0]?.message)
        .toBe('An article has either a linked organizer or a free-text author, not both')
    })

    it('accepts each source on its own', () => {
      expect(createArticleSchema.safeParse({ authorId: 'profile-1' }).success).toBe(true)
      expect(createArticleSchema.safeParse({ authorName: 'Олена Коваль' }).success).toBe(true)
    })

    // Two nulls is how the form says "no author", and a CHECK constraint is satisfied by
    // both being empty — only a *value* in both columns is ambiguous.
    it('accepts both cleared at once', () => {
      expect(createArticleSchema.safeParse({ authorId: null, authorName: null }).success).toBe(true)
    })

    it('refuses an empty authorId, which would be a blank foreign key', () => {
      expect(failedPaths(createArticleSchema, { authorId: '   ' })).toEqual(['authorId'])
    })

    it('refuses a free-text name past the column width', () => {
      expect(failedPaths(createArticleSchema, { authorName: 'x'.repeat(ARTICLE_LIMITS.AUTHOR_NAME_MAX + 1) }))
        .toEqual(['authorName'])
    })
  })

  describe('slug', () => {
    it('accepts what slugify() produces', () => {
      for (const slug of ['a', 'support-group', 'grupa-2026', 'a1-b2-c3']) {
        expect(createArticleSchema.safeParse({ slug }).success).toBe(true)
      }
    })

    it('refuses a shape the generator could not have made', () => {
      // Uppercase is folded by `.toLowerCase()` before the regex, so it is accepted; these
      // are the ones that survive folding and are still not a valid URL segment.
      for (const slug of ['has space', 'double--hyphen', '-leading', 'trailing-', 'under_score', 'київ']) {
        expect(failedPaths(createArticleSchema, { slug })).toEqual(['slug'])
      }
    })

    it('refuses a slug longer than the generator would cut at', () => {
      expect(failedPaths(createArticleSchema, { slug: 'a'.repeat(ARTICLE_LIMITS.SLUG_MAX + 1) }))
        .toEqual(['slug'])
    })

    it('is optional, so an absent slug is derived from the title', () => {
      expect(createArticleSchema.safeParse({ translations: bothTranslations() }).success).toBe(true)
    })
  })

  describe('publishedAt', () => {
    it('takes a bare calendar day, because an article is published on a day', () => {
      expect(createArticleSchema.safeParse({ publishedAt: '2026-11-19' }).success).toBe(true)
    })

    it('refuses anything that is not shaped like a bare day', () => {
      for (const publishedAt of ['2026-11-19T09:00:00.000Z', '19.11.2026', '2026-11', '19/11/2026']) {
        expect(failedPaths(createArticleSchema, { publishedAt })).toEqual(['publishedAt'])
      }
    })

    /**
     * Shape is all the schema checks: `/^\d{4}-\d{2}-\d{2}$/` cannot know that the 45th of
     * the 13th month does not exist. That is `startOfSiteDay()` in `resolvePublishedAt`,
     * which answers a 400 naming the field — see articleService.test.ts.
     */
    it('leaves an impossible day to the service, which is the layer that owns the calendar', () => {
      expect(createArticleSchema.safeParse({ publishedAt: '2026-13-45' }).success).toBe(true)
    })

    it('accepts null, which clears the day on a draft', () => {
      expect(createArticleSchema.safeParse({ publishedAt: null }).success).toBe(true)
    })
  })

  describe('translations', () => {
    it('accepts a half-written locale, since the gate is on publishing and not on saving', () => {
      const parsed = createArticleSchema.safeParse({
        translations: { ua: { title: '', content: '' } },
      })

      expect(parsed.success).toBe(true)
    })

    it('refuses a title past the column width', () => {
      expect(failedPaths(createArticleSchema, {
        translations: { ua: { title: 'x'.repeat(ARTICLE_LIMITS.TITLE_MAX + 1), content: 'Текст' } },
      })).toEqual(['translations.ua.title'])
    })

    it('refuses a body past the ceiling', () => {
      expect(failedPaths(createArticleSchema, {
        translations: { en: { title: 'Title', content: 'x'.repeat(ARTICLE_LIMITS.CONTENT_MAX + 1) } },
      })).toEqual(['translations.en.content'])
    })

    it('refuses a status outside the two an article has', () => {
      expect(failedPaths(createArticleSchema, { status: 'PENDING_REVIEW' })).toEqual(['status'])
    })
  })
})

describe('updateArticleSchema', () => {
  it('accepts an empty patch', () => {
    expect(updateArticleSchema.safeParse({}).success).toBe(true)
  })

  it('has no slug: a published URL is not renamed under the index', () => {
    const parsed = updateArticleSchema.safeParse({ slug: 'a-new-name' })

    expect(parsed.success).toBe(true)
    if (!parsed.success) return
    expect('slug' in parsed.data).toBe(false)
  })

  /**
   * The PATCH rule the project holds everywhere: `.optional()`, never `.default()`. A Zod
   * default turns an absent field into a written one, so a patch that touched the byline
   * would also reset the status and clear the publication day.
   */
  it('leaves an untouched field absent rather than filling it in', () => {
    const parsed = updateArticleSchema.safeParse({ authorName: 'Олена Коваль' })

    expect(parsed.success).toBe(true)
    if (!parsed.success) return
    expect(parsed.data.status).toBeUndefined()
    expect(parsed.data.publishedAt).toBeUndefined()
    expect(parsed.data.authorId).toBeUndefined()
    expect(parsed.data.translations).toBeUndefined()
  })

  it('keeps an explicit null, which means "clear it"', () => {
    const parsed = updateArticleSchema.safeParse({ publishedAt: null, authorName: null })

    expect(parsed.success).toBe(true)
    if (!parsed.success) return
    expect(parsed.data.publishedAt).toBeNull()
    expect(parsed.data.authorName).toBeNull()
  })

  it('applies the same author rule as create', () => {
    expect(failedPaths(updateArticleSchema, { authorId: 'p1', authorName: 'Олена' }))
      .toEqual(['authorName'])
  })
})

describe('articlesQuerySchema', () => {
  it('defaults to the first page in Ukrainian', () => {
    expect(articlesQuerySchema.parse({})).toEqual({ page: 1, locale: 'ua' })
  })

  it('coerces a query-string page number', () => {
    expect(articlesQuerySchema.parse({ page: '3', locale: 'en' })).toEqual({ page: 3, locale: 'en' })
  })

  it('refuses a page below one and a page that is not a whole number', () => {
    expect(articlesQuerySchema.safeParse({ page: '0' }).success).toBe(false)
    expect(articlesQuerySchema.safeParse({ page: '-2' }).success).toBe(false)
    expect(articlesQuerySchema.safeParse({ page: '1.5' }).success).toBe(false)
    expect(articlesQuerySchema.safeParse({ page: 'abc' }).success).toBe(false)
  })

  it('refuses a locale the site does not serve', () => {
    expect(articlesQuerySchema.safeParse({ locale: 'de' }).success).toBe(false)
  })

  /**
   * The page size is fixed by `ARTICLE_LIMITS.PAGE_SIZE`, so a caller cannot ask for the
   * whole table with `?limit=100000`. Stripping the key is what makes that true.
   */
  it('ignores a requested page size', () => {
    const parsed = articlesQuerySchema.parse({ limit: '100000', take: '100000' })

    expect(parsed).toEqual({ page: 1, locale: 'ua' })
  })
})

describe('articleLocaleQuerySchema', () => {
  it('defaults to Ukrainian and takes a locale alone', () => {
    expect(articleLocaleQuerySchema.parse({})).toEqual({ locale: 'ua' })
    expect(articleLocaleQuerySchema.parse({ locale: 'en' })).toEqual({ locale: 'en' })
    expect(articleLocaleQuerySchema.safeParse({ locale: 'ru' }).success).toBe(false)
  })
})

describe('adminArticlesQuerySchema', () => {
  it('defaults to the first twenty rows of every status', () => {
    expect(adminArticlesQuerySchema.parse({})).toEqual({ page: 1, limit: 20 })
  })

  it('caps the page size a caller may ask for', () => {
    expect(adminArticlesQuerySchema.safeParse({ limit: '101' }).success).toBe(false)
    expect(adminArticlesQuerySchema.parse({ limit: '100' })).toEqual({ page: 1, limit: 100 })
  })

  it('accepts a status filter and refuses one an article cannot have', () => {
    expect(adminArticlesQuerySchema.parse({ status: 'DRAFT' })).toEqual({ page: 1, limit: 20, status: 'DRAFT' })
    expect(adminArticlesQuerySchema.safeParse({ status: 'CANCELLED' }).success).toBe(false)
  })
})
