import type { Prisma, ArticleStatus } from '@prisma/client'
import { prisma } from '../utils/prisma'
import type { PrismaClientOrTx } from './types'
import type { Locale } from '~~/types'

/**
 * The author relation, selected rather than included.
 *
 * `verificationStatus` and `user.isActive` are not rendered anywhere: they decide whether the
 * byline is a link. A profile that is not VERIFIED, or belongs to a deactivated account, has
 * no public page — `organizer.profile.view` refuses both — so `mapLinkedAuthor` drops the
 * slug and the name renders as text instead of as a link to a 404. Same rule the group page
 * applies to a co-organizer without a profile.
 *
 * No `avatarUrl`: the byline is a line of text, and selecting a column nothing renders is
 * a column moved over the wire for nothing.
 */
const authorSelect = {
  select: {
    firstName: true,
    lastName: true,
    slug: true,
    verificationStatus: true,
    user: { select: { isActive: true } },
  },
} as const

/**
 * Every published article has both translations — `articleService.assertPublishable` is what
 * makes that true — so this filter looks redundant. It is kept because it is the invariant
 * the public surface depends on: an article in the list whose locale row is missing would be
 * a card linking to a 404, and the group catalog already carries a comment about exactly that
 * failure. A row-count condition costs one index probe on `[articleId, locale]`.
 */
function publishedInLocale(locale: Locale) {
  return {
    status: 'PUBLISHED' as ArticleStatus,
    publishedAt: { not: null },
    translations: { some: { locale } },
  }
}

export const articleRepository = {
  async slugExists(slug: string): Promise<boolean> {
    const article = await prisma.article.findUnique({ where: { slug }, select: { id: true } })
    return !!article
  },

  /**
   * One page of the public list, newest first.
   *
   * `publishedAt desc` alone is not a stable order: two articles published on the same day
   * would swap between requests and a paginated list would repeat or skip a row. `createdAt`
   * breaks the tie deterministically.
   */
  async findPublished(locale: Locale, pagination?: { skip?: number, take?: number }) {
    const { skip = 0, take = 10 } = pagination ?? {}

    return prisma.article.findMany({
      where: publishedInLocale(locale),
      include: {
        author: authorSelect,
        translations: { where: { locale }, select: { title: true, content: true } },
      },
      orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
      skip,
      take,
    })
  },

  async countPublished(locale: Locale) {
    return prisma.article.count({ where: publishedInLocale(locale) })
  },

  /**
   * The public detail read. Returns null for a slug that does not exist, is not published, or
   * has no translation in this locale — the three cases a visitor cannot and should not be
   * able to tell apart.
   */
  async findPublishedBySlug(slug: string, locale: Locale) {
    return prisma.article.findFirst({
      where: { slug, ...publishedInLocale(locale) },
      include: {
        author: authorSelect,
        translations: { where: { locale } },
      },
    })
  },

  /** Everything an admin needs to edit one article, in every locale. */
  async findBySlugForAdmin(slug: string) {
    return prisma.article.findUnique({
      where: { slug },
      include: { author: authorSelect, translations: true },
    })
  },

  async findAllAdmin(options: {
    where?: Prisma.ArticleWhereInput
    skip?: number
    take?: number
  } = {}) {
    const where = options.where ?? {}
    const skip = options.skip ?? 0
    const take = Math.min(options.take ?? 20, 100)

    const [articles, total] = await Promise.all([
      prisma.article.findMany({
        where,
        include: {
          author: { select: { firstName: true, lastName: true } },
          // Titles only: the admin list shows which locales exist and what the article is
          // called, and pulling every body would move the whole table for one screen.
          translations: { select: { locale: true, title: true } },
        },
        orderBy: { updatedAt: 'desc' },
        skip,
        take,
      }),
      prisma.article.count({ where }),
    ])

    return { articles, total }
  },

  /**
   * The sitemap query: published slugs and the date each last changed.
   *
   * `updatedAt` rather than `publishedAt` for `lastmod`, matching the group and organizer
   * entries — a corrected typo is a change a crawler should re-fetch.
   */
  async findPublishedForSitemap(take: number) {
    return prisma.article.findMany({
      where: { status: 'PUBLISHED', publishedAt: { not: null } },
      select: { slug: true, updatedAt: true },
      orderBy: { updatedAt: 'desc' },
      take,
    })
  },

  async create(data: {
    slug: string
    status: ArticleStatus
    authorId: string | null
    authorName: string | null
    publishedAt: Date | null
    createdById: string | null
  }, tx: PrismaClientOrTx = prisma) {
    return (tx as PrismaClientOrTx).article.create({ data })
  },

  async update(id: string, data: Prisma.ArticleUpdateInput, tx: PrismaClientOrTx = prisma) {
    return (tx as PrismaClientOrTx).article.update({ where: { id }, data })
  },

  /**
   * Writes one locale's copy. `upsert` on the `[articleId, locale]` pair, so the caller does
   * not have to know whether this language was filled in before.
   */
  async upsertTranslation(
    articleId: string,
    locale: Locale,
    data: { title: string, content: string },
    tx: PrismaClientOrTx = prisma,
  ) {
    return (tx as PrismaClientOrTx).articleTranslation.upsert({
      where: { articleId_locale: { articleId, locale } },
      create: { articleId, locale, ...data },
      update: data,
    })
  },

  async deleteTranslation(articleId: string, locale: Locale, tx: PrismaClientOrTx = prisma) {
    return (tx as PrismaClientOrTx).articleTranslation.deleteMany({ where: { articleId, locale } })
  },

  async findByIdForAdmin(id: string) {
    return prisma.article.findUnique({
      where: { id },
      select: { id: true, slug: true, status: true },
    })
  },

  /** The translations that exist, as locale codes — the publish gate reads this. */
  async findTranslationLocales(articleId: string, tx: PrismaClientOrTx = prisma) {
    const rows = await (tx as PrismaClientOrTx).articleTranslation.findMany({
      where: { articleId },
      select: { locale: true, title: true, content: true },
    })

    return rows
  },

  /**
   * Removes the article; translations go with it through `ON DELETE CASCADE`.
   *
   * Deleting by slug rather than by id keeps the handler from needing a read before the
   * write, and the unique index makes the target unambiguous.
   */
  async deleteBySlug(slug: string) {
    return prisma.article.delete({ where: { slug } })
  },

  async findAuthorProfile(organizerProfileId: string) {
    return prisma.organizerProfile.findUnique({
      where: { id: organizerProfileId },
      select: { id: true, firstName: true, lastName: true, verificationStatus: true, user: { select: { isActive: true } } },
    })
  },
}

export { authorSelect }
