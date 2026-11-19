import { requireAuth } from '../../../utils/auth'
import { requirePermission } from '../../../utils/permissions'
import { articleService } from '../../../services/articleService'
import { createArticleSchema } from '../../../validators/article'
import { apiError } from '../../../utils/apiError'
import { ErrorCodes } from '../../../utils/errorCodes'
import { findDomainError, mapDomainError } from '../../../utils/mapDomainError'
import { mapPrismaError } from '../../../utils/errorHandler'

/**
 * Creates an article.
 *
 * An empty body is a valid request and produces a blank DRAFT, the way `POST /api/groups`
 * does — the form saves early and often, and the publish gate lives in the service rather
 * than here so that creating and updating cannot drift apart on it.
 */
export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  requirePermission(user, 'admin.articles.moderate')

  const parsed = createArticleSchema.safeParse(await readBody(event) ?? {})
  if (!parsed.success) {
    throw apiError(400, ErrorCodes.VALIDATION_FAILED, 'Validation failed', { details: parsed.error.issues })
  }

  try {
    const article = await articleService.create(parsed.data, { userId: user.id })

    return {
      success: true,
      article: { slug: article.slug, status: article.status },
    }
  }
  catch (error) {
    // Already-shaped H3 errors (a 401/403 from the guards above cannot reach here, but a
    // nested handler could throw one) keep their status; a domain failure is mapped to its
    // trusted code; only a driver error falls through to the Prisma mapping.
    if (error && typeof error === 'object' && 'statusCode' in error) throw error
    if (findDomainError(error)) mapDomainError(error)
    throw mapPrismaError(error, 'admin.articles.post')
  }
})
