import { requireAuth } from '../../../utils/auth'
import { requirePermission } from '../../../utils/permissions'
import { articleService } from '../../../services/articleService'
import { apiError } from '../../../utils/apiError'
import { ErrorCodes } from '../../../utils/errorCodes'
import { findDomainError, mapDomainError } from '../../../utils/mapDomainError'
import { mapPrismaError } from '../../../utils/errorHandler'
import { mapAdminArticleForm } from '../../../utils/articleResponse'

/**
 * The edit form's load: markdown source in both locales, plus the byline and the date.
 *
 * Deliberately not the public detail endpoint. That one returns rendered nodes and only for
 * a published article; an editor needs the raw source and needs a draft to resolve, and
 * making one endpoint serve both would mean shipping unpublished copy to whoever can guess a
 * slug.
 */
export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  requirePermission(user, 'admin.articles.view')

  const slug = getRouterParam(event, 'slug')
  if (!slug) {
    throw apiError(400, ErrorCodes.VALIDATION_FAILED, 'Article slug is required')
  }

  try {
    const article = await articleService.getForAdmin(slug)
    return mapAdminArticleForm(article)
  }
  catch (error) {
    if (error && typeof error === 'object' && 'statusCode' in error) throw error
    if (findDomainError(error)) mapDomainError(error)
    throw mapPrismaError(error, 'admin.articles.get')
  }
})
