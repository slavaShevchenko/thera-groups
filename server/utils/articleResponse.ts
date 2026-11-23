import { markdownToText, parseMarkdown, truncateText } from './markdown'
import { siteDayString } from './siteTime'
import { ARTICLE_LIMITS } from '~~/shared/constants/limits'
import type { articleRepository } from '../repositories/articleRepository'
import type { ArticleAuthor, Locale } from '~~/types'

/**
 * Public and admin response mappers for article endpoints.
 *
 * The same two rules the group mappers follow: the public identifier is the slug, so the
 * article's cuid never leaves the server, and nothing a visitor cannot see on the page is in
 * the payload. Two things are specific to articles:
 *
 *  - the body goes out as parsed nodes, not as the stored markdown and not as HTML. The
 *    client carries no markdown parser and this path has no `v-html`;
 *  - the byline is decided here, because "is this profile publicly reachable" is a server
 *    question. `verificationStatus` and `user.isActive` are read and then dropped, and the
 *    client only ever sees a name plus a slug that is null when there is no page to link to.
 */

type PublishedListRow = Awaited<ReturnType<typeof articleRepository.findPublished>>[number]
type PublishedDetailRow = NonNullable<Awaited<ReturnType<typeof articleRepository.findPublishedBySlug>>>
type LatestHeadlineRow = Awaited<ReturnType<typeof articleRepository.findLatestHeadlines>>[number]
type AdminRow = NonNullable<Awaited<ReturnType<typeof articleRepository.findBySlugForAdmin>>>
type AdminListRow = Awaited<ReturnType<typeof articleRepository.findAllAdmin>>['articles'][number]

type AuthorRelation = PublishedListRow['author']

/**
 * A linked organizer as a byline, or null when there is nobody to credit.
 *
 * The slug is withheld unless the profile has a public page: `organizer.profile.view` refuses
 * an unverified profile and refuses a deactivated account outright, so linking to either
 * would hand a visitor a 404. The name still shows — an article does not stop having been
 * written by somebody because their profile moved out of moderation.
 */
function mapLinkedAuthor(author: AuthorRelation): ArticleAuthor | null {
  if (!author) return null

  const name = `${author.firstName} ${author.lastName}`.trim()
  if (!name) return null

  const isPubliclyReachable = author.verificationStatus === 'VERIFIED'
    && author.user?.isActive !== false

  return {
    name,
    slug: isPubliclyReachable ? author.slug : null,
  }
}

/** The byline, from whichever of the two mutually exclusive sources the row uses. */
function mapByline(row: { author: AuthorRelation, authorName: string | null }): ArticleAuthor | null {
  const linked = mapLinkedAuthor(row.author)
  if (linked) return linked

  const freeText = row.authorName?.trim()
  return freeText ? { name: freeText, slug: null } : null
}

/**
 * The two prose cuts of one body, parsed once.
 *
 * Both come from the same plain text so they can never disagree about what the article says;
 * only the budget differs. The card clamps visually on top of the excerpt, and the meta
 * description is what a search engine shows — a description longer than the snippet would have
 * Google quote text no visitor ever saw on the page that ranked for it.
 */
function deriveTexts(content: string) {
  const text = markdownToText(parseMarkdown(content))

  return {
    excerpt: truncateText(text, ARTICLE_LIMITS.EXCERPT_MAX),
    metaDescription: truncateText(text, ARTICLE_LIMITS.META_DESCRIPTION_MAX),
  }
}

/**
 * The publication day, as a bare `YYYY-MM-DD`.
 *
 * An article has a publication *day*, not a moment, and the payload says so: sending the
 * stored instant would let the client render a time the editor never chose, and would shift
 * the displayed day for a visitor west of Kyiv, because `new Date('…T22:00:00Z')` formatted in
 * a local zone is the previous evening. `siteDayString()` reads the day back in the same zone
 * `startOfSiteDay()` wrote it in, so the two are exact inverses and the day survives the trip.
 *
 * The query filters on `publishedAt: { not: null }` and the table carries a CHECK that a
 * published row has one, so the fallback is unreachable — but Prisma's return type is
 * `Date | null` either way, and letting that through would put a null where the page renders a
 * date and the JSON-LD puts `datePublished`. `updatedAt` is the honest stand-in, not
 * `createdAt`: it is the day the row last changed, which for anything published today is the
 * same day.
 */
function publishedDayOf(row: { publishedAt: Date | null, updatedAt: Date }): string {
  return siteDayString(row.publishedAt ?? row.updatedAt)
}

/**
 * The single translation a public read carries.
 *
 * Both public queries constrain `translations` to the requested locale, and
 * `[articleId, locale]` is unique, so the array holds exactly one row. Taking the first is
 * not a guess about which language won — the locale param never reaches the row at all, which
 * is why the list query can `select` only the fields it renders.
 *
 * Inferred over the *element* type rather than over the row, so every caller keeps exactly
 * the columns its own query selected: a headline row carries a title and nothing else, a list
 * row carries the body too.
 */
function soleTranslation<T extends { title: string }>(row: { translations: readonly T[] }): T | undefined {
  return row.translations[0]
}

/**
 * One row of the home page's latest-articles block: a date and a linked title.
 *
 * The narrowest public article payload there is. It carries no excerpt, because the block
 * renders none, and no byline, because it renders none either — and the query behind it
 * selects neither, so there is nothing here to accidentally drop.
 */
export function mapArticleTeaser(row: LatestHeadlineRow) {
  const translation = soleTranslation(row)

  return {
    slug: row.slug,
    title: translation?.title?.trim() || row.slug,
    publishedDate: publishedDayOf(row),
  }
}

export function mapArticleListItem(row: PublishedListRow) {
  const translation = soleTranslation(row)
  const { excerpt } = deriveTexts(translation?.content ?? '')

  return {
    slug: row.slug,
    title: translation?.title?.trim() || row.slug,
    excerpt,
    publishedDate: publishedDayOf(row),
    author: mapByline(row),
  }
}

export function mapArticleForPublic(row: PublishedDetailRow, locale: Locale) {
  const translation = soleTranslation(row)
  const { excerpt, metaDescription } = deriveTexts(translation?.content ?? '')

  return {
    slug: row.slug,
    locale,
    title: translation?.title?.trim() || row.slug,
    content: parseMarkdown(translation?.content ?? ''),
    excerpt,
    metaDescription,
    publishedDate: publishedDayOf(row),
    // A real instant, and the one field on this payload that is: `dateModified` in the
    // Article JSON-LD, where a revision genuinely has a time and a crawler reads the
    // difference between a corrected article and a stale one.
    updatedAt: row.updatedAt.toISOString(),
    author: mapByline(row),
  }
}

/**
 * One row of the admin list.
 *
 * `locales` is the set of translation rows that exist, which is the same as the set of
 * languages something was written in: `writeTranslations` deletes a locale whose title and
 * body were both emptied, so a row is never an empty placeholder. The list can therefore show
 * which languages are still missing — the reason a publish was refused — without pulling
 * either body off the database.
 */
export function mapAdminArticleListItem(row: AdminListRow) {
  const present = row.translations.map(entry => entry.locale)
  const preferred = row.translations.find(entry => entry.locale === 'ua')
    ?? row.translations.find(entry => entry.locale === 'en')

  const author = row.author
    ? `${row.author.firstName} ${row.author.lastName}`.trim()
    : ''

  return {
    slug: row.slug,
    status: row.status,
    title: preferred?.title?.trim() || row.slug,
    publishedDate: row.publishedAt ? siteDayString(row.publishedAt) : null,
    authorName: author || row.authorName?.trim() || null,
    locales: (['ua', 'en'] as Locale[]).filter(locale => present.includes(locale)),
    updatedAt: row.updatedAt.toISOString(),
  }
}

/** What the admin form loads: the markdown source, unrendered, in both locales. */
export function mapAdminArticleForm(row: AdminRow) {
  const translations: Partial<Record<Locale, { title: string, content: string }>> = {}

  for (const entry of row.translations) {
    if (entry.locale !== 'ua' && entry.locale !== 'en') continue
    translations[entry.locale] = { title: entry.title, content: entry.content }
  }

  return {
    slug: row.slug,
    status: row.status,
    authorId: row.authorId,
    authorName: row.authorName,
    // The name of the linked profile, so the form can show a selection it did not make in this
    // session. Null when the author is free-text or absent, which the picker reads as "nothing
    // selected".
    linkedAuthorName: row.author
      ? `${row.author.firstName} ${row.author.lastName}`.trim() || null
      : null,
    // Back to the bare day the date input holds, in the zone it was read in.
    publishedAt: row.publishedAt ? siteDayString(row.publishedAt) : null,
    translations,
  }
}
