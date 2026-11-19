import { articleService } from '../../services/articleService'
import { articleLocaleQuerySchema } from '../../validators/article'
import { apiError } from '../../utils/apiError'
import { ErrorCodes } from '../../utils/errorCodes'
import { mapArticleForPublic } from '../../utils/articleResponse'

/**
 * One published article, rendered in the requested locale.
 *
 * A 404 answers for a slug that never existed, for one that is still a draft, and for one
 * that has no translation in this language. The three are indistinguishable on purpose: the
 * first two are the same rule `CANCELLED` groups follow, and the third cannot happen through
 * the publish gate — but if it ever did, saying "this exists, just not in English" would
 * advertise an unpublished slug.
 */
export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug')
  if (!slug) {
    throw apiError(400, ErrorCodes.VALIDATION_FAILED, 'Article slug is required')
  }

  const parsed = articleLocaleQuerySchema.safeParse(getQuery(event))
  if (!parsed.success) {
    throw apiError(400, ErrorCodes.VALIDATION_FAILED, 'Invalid query parameters')
  }

  const article = await articleService.getPublished(slug, parsed.data.locale)
  if (!article) {
    throw apiError(404, ErrorCodes.NOT_FOUND, 'Article not found')
  }

  return mapArticleForPublic(article, parsed.data.locale)
})
