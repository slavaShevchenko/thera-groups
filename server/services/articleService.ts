import type { ArticleStatus, Prisma } from '@prisma/client'
import { articleRepository } from '../repositories/articleRepository'
import { prisma } from '../utils/prisma'
import { generateUniqueSlug } from '../utils/slugify'
import { ConflictError, NotFoundError, ValidationError } from '../utils/domainErrors'
import { siteDayString, startOfSiteDay } from '../utils/siteTime'
import { ARTICLE_LIMITS } from '~~/shared/constants/limits'
import type { PrismaClientOrTx } from '../repositories/types'
import type { ArticleInput, ArticleUpdateInput } from '../validators/article'
import type { Locale } from '~~/types'

/**
 * The locales an article must be complete in before it can be published — all of them.
 *
 * This is the rule that makes the public surface simple. `/[locale]/articles/[slug]` is
 * rendered for both locales, `useLocaleHead()` advertises an `hreflang` alternate for both on
 * every page, and `sitemap.xml` emits a `<url>` pair per article. All three are only honest
 * if both pages exist: Google requires an advertised alternate not to redirect or 404, and a
 * set with a hole in it invalidates the hreflang for every page in it. A draft with one
 * language is a normal working state; publishing it is not.
 */
const ARTICLE_LOCALES: readonly Locale[] = ['ua', 'en']

type TranslationRow = { locale: string, title: string, content: string }

/**
 * The locales that are missing an actual article, not merely a row.
 *
 * A row with an empty title or an empty body counts as missing: the form saves a translation
 * while it is being written, so "exists" and "is finished" are different questions, and only
 * the second one gates publishing.
 */
export function incompleteLocales(rows: TranslationRow[]): Locale[] {
  const byLocale = new Map(rows.map(row => [row.locale as Locale, row]))

  return ARTICLE_LOCALES.filter((locale) => {
    const row = byLocale.get(locale)
    return !row || !row.title.trim() || !row.content.trim()
  })
}

/**
 * The slug base: the Ukrainian title, then the English one, then a placeholder.
 *
 * Ukrainian first because it is the default locale and the one an article is written in
 * first; `slugify()` transliterates it, so the URL stays ASCII either way.
 */
function slugBase(translations: ArticleInput['translations']): string {
  return translations?.ua?.title?.trim()
    || translations?.en?.title?.trim()
    || 'article'
}

async function resolveSlug(explicit: string | undefined, translations: ArticleInput['translations']): Promise<string> {
  if (!explicit) {
    return generateUniqueSlug(slugBase(translations), slug => articleRepository.slugExists(slug))
  }

  // A slug an admin typed is a URL they intend to keep, so a collision is reported rather
  // than silently suffixed — `generateUniqueSlug` would append six random hex characters and
  // the address in the browser would not be the one that was asked for.
  if (await articleRepository.slugExists(explicit)) {
    throw new ConflictError(`Slug is already taken: ${explicit}`)
  }

  return explicit
}

/**
 * Checks the byline target exists.
 *
 * Nothing here requires the profile to be VERIFIED. An admin may attribute an article to any
 * organizer, and a profile that is not publicly reachable simply renders its name without a
 * link — `mapArticleAuthor` decides that from `verificationStatus` and `user.isActive`, which
 * is where the rule already lives for groups.
 */
async function resolveAuthorId(authorId: string | null | undefined): Promise<string | null> {
  if (!authorId) return null

  const profile = await articleRepository.findAuthorProfile(authorId)
  if (!profile) {
    throw new NotFoundError('Author organizer profile not found')
  }

  return profile.id
}

/**
 * The publication day, from a bare `YYYY-MM-DD`.
 *
 * `undefined` means "not part of this request" and leaves the stored value alone; `null`
 * means "clear it", which is only legal on a draft — the CHECK on `Article` refuses a
 * published row without a date, and `assertPublishable` says so first with a message an admin
 * can act on.
 */
function resolvePublishedAt(raw: string | null | undefined): Date | null | undefined {
  if (raw === undefined) return undefined
  if (raw === null) return null

  const date = startOfSiteDay(raw)
  if (!date) {
    throw new ValidationError(`Invalid publication date: ${raw}`, 'publishedAt')
  }

  return date
}

/**
 * Publishing with no date chosen means "today", in the site zone.
 *
 * The form pre-fills a date so this is the rare path, but it is reachable — clear the field,
 * press publish — and the alternatives are worse: a database CHECK violation surfaces as an
 * unmapped 500, and refusing forces the admin to guess which field the error is about.
 */
function orToday(date: Date | null): Date {
  return date ?? startOfSiteDay(siteDayString())!
}

function assertPublishable(missing: Locale[], publishedAt: Date | null): void {
  if (missing.length > 0) {
    throw new ValidationError(
      `An article is published in every locale at once; missing or unfinished: ${missing.join(', ')}`,
      'translations',
    )
  }
  // Unreachable through the form, which always sends a date, and covered by `orToday` at both
  // call sites. Kept as a check rather than an assumption because the database enforces it
  // too, and a 500 from a CHECK is a worse answer than a 400 naming the field.
  if (!publishedAt) {
    throw new ValidationError('A published article needs a publication date', 'publishedAt')
  }
}

/**
 * Writes whichever locales the request carries, and removes one that was emptied.
 *
 * Absent means untouched; present-but-empty means "this language was withdrawn", which
 * deletes the row so `incompleteLocales` keeps telling the truth. Content is stored exactly
 * as submitted — markdown source, not rendered HTML — so an edit round-trips losslessly.
 */
async function writeTranslations(
  articleId: string,
  translations: ArticleInput['translations'],
  tx: PrismaClientOrTx,
) {
  if (!translations) return

  for (const locale of ARTICLE_LOCALES) {
    const input = translations[locale]
    if (input === undefined) continue

    if (!input.title.trim() && !input.content.trim()) {
      await articleRepository.deleteTranslation(articleId, locale, tx)
      continue
    }

    await articleRepository.upsertTranslation(
      articleId,
      locale,
      { title: input.title.trim(), content: input.content },
      tx,
    )
  }
}

export const articleService = {
  async getPublishedList(locale: Locale, pagination?: { skip?: number, take?: number }) {
    const [articles, total] = await Promise.all([
      articleRepository.findPublished(locale, pagination),
      articleRepository.countPublished(locale),
    ])

    return { articles, total }
  },

  /**
   * The newest published headlines for the home page's discovery block.
   *
   * No `total` alongside them, unlike `getPublishedList`: the block renders what it gets and
   * links to the archive for the rest, so a second query to count rows it will never show
   * would be a round trip bought for nothing.
   */
  async getLatestHeadlines(locale: Locale, limit = ARTICLE_LIMITS.HOME_TEASER_COUNT) {
    return articleRepository.findLatestHeadlines(locale, limit)
  },

  /**
   * One published article in one locale, or null.
   *
   * Null covers "no such slug", "exists but is a draft" and "exists but not in this
   * language" alike, because telling them apart would tell a visitor which unpublished
   * slugs exist.
   */
  async getPublished(slug: string, locale: Locale) {
    return articleRepository.findPublishedBySlug(slug, locale)
  },

  async getForAdmin(slug: string) {
    const article = await articleRepository.findBySlugForAdmin(slug)
    if (!article) throw new NotFoundError('Article not found')

    return article
  },

  async listForAdmin(options: { status?: ArticleStatus, skip?: number, take?: number } = {}) {
    return articleRepository.findAllAdmin({
      where: options.status ? { status: options.status } : {},
      skip: options.skip,
      take: options.take,
    })
  },

  /**
   * Creates an article with whichever translations the form carries.
   *
   * The publish gate is checked against the payload rather than read back, because at this
   * point the payload *is* the whole state — there is no stored translation to merge with.
   * The row is written in one transaction with its translations, so a gate that fails leaves
   * nothing behind.
   */
  async create(input: ArticleInput, ctx: { userId: string }) {
    const status: ArticleStatus = input.status ?? 'DRAFT'
    const authorId = await resolveAuthorId(input.authorId)
    const slug = await resolveSlug(input.slug, input.translations)

    let publishedAt = resolvePublishedAt(input.publishedAt) ?? null
    if (status === 'PUBLISHED') {
      const rows: TranslationRow[] = ARTICLE_LOCALES.flatMap((locale) => {
        const translation = input.translations?.[locale]
        return translation
          ? [{ locale, title: translation.title, content: translation.content }]
          : []
      })
      publishedAt = orToday(publishedAt)
      assertPublishable(incompleteLocales(rows), publishedAt)
    }

    return prisma.$transaction(async (tx) => {
      const article = await articleRepository.create({
        slug,
        status,
        authorId,
        authorName: input.authorName?.trim() || null,
        publishedAt,
        createdById: ctx.userId,
      }, tx)

      await writeTranslations(article.id, input.translations, tx)

      return article
    })
  },

  /**
   * Updates an article and, in the same transaction, re-checks the publish gate against the
   * merged state.
   *
   * The gate runs on every update whose *effective* status is PUBLISHED, not only on the
   * transition into it: emptying the English title of a live article would otherwise leave a
   * published URL whose hreflang alternate says it exists in a language it no longer does.
   */
  async update(slug: string, input: ArticleUpdateInput) {
    const existing = await articleRepository.findBySlugForAdmin(slug)
    if (!existing) throw new NotFoundError('Article not found')

    const status: ArticleStatus = input.status ?? existing.status
    const authorId = input.authorId === undefined
      ? undefined
      : await resolveAuthorId(input.authorId)
    const requestedPublishedAt = resolvePublishedAt(input.publishedAt)
    let publishedAt = requestedPublishedAt === undefined
      ? existing.publishedAt
      : requestedPublishedAt

    if (status === 'PUBLISHED') {
      publishedAt = orToday(publishedAt)
    }

    /**
     * The byline has one source and a CHECK constraint enforces it, so choosing one clears
     * the other. Done here rather than in the schema because a form sends only the field the
     * admin touched: without this, picking an organizer on an article that had a free-text
     * author would write both and fail on the constraint.
     */
    const authorPatch: Prisma.ArticleUpdateInput = {}
    if (authorId !== undefined) {
      authorPatch.author = authorId ? { connect: { id: authorId } } : { disconnect: true }
      if (authorId) authorPatch.authorName = null
    }
    if (input.authorName !== undefined) {
      const name = input.authorName?.trim() || null
      authorPatch.authorName = name
      if (name) authorPatch.author = { disconnect: true }
    }

    return prisma.$transaction(async (tx) => {
      await writeTranslations(existing.id, input.translations, tx)

      if (status === 'PUBLISHED') {
        // Read back inside the transaction: `writeTranslations` above may have added, changed
        // or removed a locale, and the gate has to judge the state this commit will leave
        // behind rather than the state the request happened to describe.
        const rows = await articleRepository.findTranslationLocales(existing.id, tx)
        assertPublishable(incompleteLocales(rows), publishedAt)
      }

      return articleRepository.update(existing.id, {
        status,
        publishedAt,
        ...authorPatch,
      }, tx)
    })
  },

  /**
   * Removes an article and, through `ON DELETE CASCADE`, every translation of it.
   *
   * Unlike a group there is nothing hanging off it that somebody else owns — no applications,
   * no answers — so there is no `HAS_APPLICATIONS`-style refusal to make. The cost is a URL
   * that was indexed and now 404s, which is the admin's call to make and the reason the UI
   * asks for a confirmation.
   */
  async remove(slug: string) {
    const existing = await articleRepository.findBySlugForAdmin(slug)
    if (!existing) throw new NotFoundError('Article not found')

    await articleRepository.deleteBySlug(slug)

    return { slug }
  },

  async slugExists(slug: string) {
    return articleRepository.slugExists(slug)
  },
}
