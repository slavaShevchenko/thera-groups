import { articleService } from '../../services/articleService'
import { articlesQuerySchema } from '../../validators/article'
import { apiError } from '../../utils/apiError'
import { ErrorCodes } from '../../utils/errorCodes'
import { mapArticleListItem } from '../../utils/articleResponse'
import { ARTICLE_LIMITS } from '~~/shared/constants/limits'

/**
 * The public article list, in one locale.
 *
 * Anonymous by design — this is a published reading surface, not an account feature, so
 * nothing here calls `getUser()`. A draft is unreachable through it: the service filters on
 * `status = PUBLISHED` and on the existence of a translation in the requested locale, so the
 * list can never link to a page that 404s.
 */
export default defineEventHandler(async (event) => {
  const parsed = articlesQuerySchema.safeParse(getQuery(event))
  if (!parsed.success) {
    throw apiError(400, ErrorCodes.VALIDATION_FAILED, 'Invalid query parameters')
  }

  const { page, locale } = parsed.data
  const limit = ARTICLE_LIMITS.PAGE_SIZE
  const skip = (page - 1) * limit

  const { articles, total } = await articleService.getPublishedList(locale, { skip, take: limit })

  return {
    articles: articles.map(mapArticleListItem),
    total,
    page,
    // Never 0: the page renders "page 1 of N" and an empty catalog is still page 1 of 1.
    totalPages: Math.max(1, Math.ceil(total / limit)),
  }
})
