import { z } from 'zod'
import { ARTICLE_LIMITS } from '~~/shared/constants/limits'

/**
 * The two locales an article is published in. Spelled out rather than read from a constant
 * so the schema shape stays a literal object — `z.record(z.enum(…))` in Zod 4 requires every
 * enum member to be present, which is the opposite of what a draft needs.
 */
const translationInputSchema = z.object({
  /**
   * No `min(1)`: a translation is saved while it is being written, and an empty title is how
   * the form says "this language is not started yet". The publish gate — not the schema — is
   * what insists both locales are complete, because that is a rule about the article as a
   * whole and no single field can express it.
   */
  title: z.string().trim().max(ARTICLE_LIMITS.TITLE_MAX),
  content: z.string().trim().max(ARTICLE_LIMITS.CONTENT_MAX),
})

/**
 * `POST` and `PATCH` share one shape, and every field is optional in both.
 *
 * Optional-on-create is deliberate and matches `createGroupSchema`: an empty body creates a
 * blank DRAFT, which is what the admin form does before the first save. Optional-on-patch is
 * the project rule — `.optional()`, never `.default()` — because a Zod default turns an
 * absent field into a written one, so a PATCH that touched the byline would also reset the
 * status.
 *
 * There is no `slug` here on purpose. It is set once, at creation, and renaming it afterwards
 * would move a URL that is already indexed, sitemapped and hreflang-linked; the group editor
 * has no slug field for the same reason.
 */
const articleInputShape = {
  status: z.enum(['DRAFT', 'PUBLISHED']).optional(),
  /**
   * A bare `YYYY-MM-DD`, which is what a date input holds and all the page shows — an
   * article has a publication day, not a publication minute. Read as a calendar day in the
   * site zone by `startOfSiteDay()`, exactly like a catalog `dateFrom` filter.
   */
  publishedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected a YYYY-MM-DD date').nullable().optional(),
  authorId: z.string().trim().min(1).max(50).nullable().optional(),
  authorName: z.string().trim().max(ARTICLE_LIMITS.AUTHOR_NAME_MAX).nullable().optional(),
  translations: z.object({
    ua: translationInputSchema.optional(),
    en: translationInputSchema.optional(),
  }).optional(),
}

/**
 * The byline has one source. Two at once is not a malformed request so much as an ambiguous
 * one — which name should the page print? — so it is refused here with a 400 rather than left
 * to the database CHECK, whose violation would surface as an unmapped 500.
 *
 * The context is typed structurally rather than as Zod's own refinement type because the
 * issue object is written inline: hoisting it behind `as const` makes `path` readonly, which
 * `addIssue` refuses.
 */
const AUTHOR_CONFLICT_MESSAGE = 'An article has either a linked organizer or a free-text author, not both'

function rejectBothAuthorSources(
  data: { authorId?: string | null, authorName?: string | null },
  ctx: { addIssue: (_issue: { code: 'custom', path: string[], message: string }) => void },
) {
  if (data.authorId && data.authorName) {
    ctx.addIssue({ code: 'custom', path: ['authorName'], message: AUTHOR_CONFLICT_MESSAGE })
  }
}

export const createArticleSchema = z.object({
  /**
   * Optional and validated to the exact shape `slugify()` produces, so a slug an admin typed
   * cannot differ in kind from one the generator made. Absent means "derive it from the
   * Ukrainian title".
   */
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug may contain lowercase letters, digits and single hyphens')
    .max(ARTICLE_LIMITS.SLUG_MAX)
    .optional(),
  ...articleInputShape,
}).superRefine(rejectBothAuthorSources)

export const updateArticleSchema = z.object(articleInputShape).superRefine(rejectBothAuthorSources)

/**
 * Public list and detail.
 *
 * `locale` is a query parameter rather than something read off the request, because the
 * authority for it is the URL path the visitor is on — `/en/articles` — and the API path
 * carries no locale segment. The cookie is not a substitute: a first-time visitor of `/en/*`
 * has none (see app/middleware/locale.global.ts), and falling back to `ua` there would serve
 * Ukrainian copy on an English page.
 *
 * The page size is fixed by `ARTICLE_LIMITS.PAGE_SIZE` rather than taken from the query: the
 * list is a paginated public page, not an API a caller shapes, and letting `limit` through
 * would let one request pull the whole table.
 */
export const articlesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  locale: z.enum(['ua', 'en']).default('ua'),
})

/** The detail read takes a locale and nothing else — one article is not paginated. */
export const articleLocaleQuerySchema = z.object({
  locale: z.enum(['ua', 'en']).default('ua'),
})

/** Admin list: every status, paged, newest-edited first. */
export const adminArticlesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['DRAFT', 'PUBLISHED']).optional(),
})

export type ArticleInput = z.infer<typeof createArticleSchema>
export type ArticleUpdateInput = z.infer<typeof updateArticleSchema>
export type ArticleTranslationInput = z.infer<typeof translationInputSchema>
