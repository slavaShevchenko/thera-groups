import { requireAuth } from '../../../utils/auth'
import { requirePermission } from '../../../utils/permissions'
import { articleService } from '../../../services/articleService'
import { apiError } from '../../../utils/apiError'
import { ErrorCodes } from '../../../utils/errorCodes'
import { findDomainError, mapDomainError } from '../../../utils/mapDomainError'
import { mapPrismaError } from '../../../utils/errorHandler'

/**
 * Deletes an article and, through `ON DELETE CASCADE`, every translation of it.
 *
 * There is no `HAS_APPLICATIONS`-style guard here, and that is a difference from deleting a
 * group rather than an oversight: nothing anybody else owns hangs off an article. What it
 * does cost is a URL that was indexed, sitemapped and hreflang-linked and now 404s, so the
 * admin UI confirms before calling and the sitemap simply stops listing it.
 */
export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  requirePermission(user, 'admin.articles.moderate')

  const slug = getRouterParam(event, 'slug')
  if (!slug) {
    throw apiError(400, ErrorCodes.VALIDATION_FAILED, 'Article slug is required')
  }

  try {
    return await articleService.remove(slug)
  }
  catch (error) {
    if (error && typeof error === 'object' && 'statusCode' in error) throw error
    if (findDomainError(error)) mapDomainError(error)
    throw mapPrismaError(error, 'admin.articles.delete')
  }
})
