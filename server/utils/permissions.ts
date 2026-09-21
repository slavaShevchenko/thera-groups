import { can } from '~~/shared/utils/permissions'
import type { Permission } from '~~/shared/utils/permissions'
import type { User } from '@prisma/client'

export function requirePermission(
  user: User,
  permission: Permission,
  resource?: Record<string, unknown> | null,
): void {
  if (!can(permission, user, resource)) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Forbidden',
    })
  }
}
