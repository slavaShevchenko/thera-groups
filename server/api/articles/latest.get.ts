import { articleService } from '../../services/articleService'
import { articleLocaleQuerySchema } from '../../validators/article'
import { apiError } from '../../utils/apiError'
import { ErrorCodes } from '../../utils/errorCodes'
import { mapArticleTeaser } from '../../utils/articleResponse'

/**
 * The newest published headlines, for the home page's discovery block.
 *
 * A sibling of `/api/groups/latest` rather than a `limit` on the list endpoint: the list is a
 * paginated public page whose page size is fixed on purpose (see `articlesQuerySchema`), and
 * this one answers a different question — the top of the archive, titles only, with no count
 * and no pagination. Anonymous like the rest of the reading surface.
 *
 * `latest` is a static segment, so Nitro routes it here and not to `[slug].get.ts`; the cost
 * is that an article cannot be published under the slug `latest`, exactly as a group cannot.
 */
export default defineEventHandler(async (event) => {
  const parsed = articleLocaleQuerySchema.safeParse(getQuery(event))
  if (!parsed.success) {
    throw apiError(400, ErrorCodes.VALIDATION_FAILED, 'Invalid query parameters')
  }

  const articles = await articleService.getLatestHeadlines(parsed.data.locale)

  return articles.map(mapArticleTeaser)
})
