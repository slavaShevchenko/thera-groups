import { requireAuth } from '../../../utils/auth'
import { requirePermission } from '../../../utils/permissions'
import { articleService } from '../../../services/articleService'
import { adminArticlesQuerySchema } from '../../../validators/article'
import { apiError } from '../../../utils/apiError'
import { ErrorCodes } from '../../../utils/errorCodes'
import { mapAdminArticleListItem } from '../../../utils/articleResponse'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  requirePermission(user, 'admin.articles.view')

  const parsed = adminArticlesQuerySchema.safeParse(getQuery(event))
  if (!parsed.success) {
    throw apiError(400, ErrorCodes.VALIDATION_FAILED, 'Invalid query parameters')
  }

  const { page, limit, status } = parsed.data
  const { articles, total } = await articleService.listForAdmin({
    status,
    skip: (page - 1) * limit,
    take: limit,
  })

  return {
    articles: articles.map(mapAdminArticleListItem),
    total,
    page,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  }
})
