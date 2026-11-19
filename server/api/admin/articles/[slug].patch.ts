import { requireAuth } from '../../../utils/auth'
import { requirePermission } from '../../../utils/permissions'
import { articleService } from '../../../services/articleService'
import { updateArticleSchema } from '../../../validators/article'
import { apiError } from '../../../utils/apiError'
import { ErrorCodes } from '../../../utils/errorCodes'
import { findDomainError, mapDomainError } from '../../../utils/mapDomainError'
import { mapPrismaError } from '../../../utils/errorHandler'
import { mapAdminArticleForm } from '../../../utils/articleResponse'

/**
 * Updates an article, its byline, its date and whichever locales the body carries.
 *
 * Returns the form shape rather than a bare success flag so the editor can resync from the
 * server's view of the row — the slug it did not send, the date it just normalized, the
 * translations it just emptied and had deleted.
 */
export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  requirePermission(user, 'admin.articles.moderate')

  const slug = getRouterParam(event, 'slug')
  if (!slug) {
    throw apiError(400, ErrorCodes.VALIDATION_FAILED, 'Article slug is required')
  }

  const parsed = updateArticleSchema.safeParse(await readBody(event) ?? {})
  if (!parsed.success) {
    throw apiError(400, ErrorCodes.VALIDATION_FAILED, 'Validation failed', { details: parsed.error.issues })
  }

  try {
    await articleService.update(slug, parsed.data)
    return mapAdminArticleForm(await articleService.getForAdmin(slug))
  }
  catch (error) {
    if (error && typeof error === 'object' && 'statusCode' in error) throw error
    if (findDomainError(error)) mapDomainError(error)
    throw mapPrismaError(error, 'admin.articles.patch')
  }
})
