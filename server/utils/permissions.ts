import { can } from '~~/shared/utils/permissions'
import type { User } from '@prisma/client'

/**
 * Checks if a user has the given permission, throwing a 403 error if not.
 * Delegates to the shared `can()` function for the actual permission evaluation.
 * @param user - The authenticated user
 * @param permission - The permission key to check (e.g. 'group.edit', 'admin.panel')
 * @param resource - Optional resource context for ownership-based checks
 * @throws 403 error if the user does not have the required permission
 */
export function requirePermission(
  user: User,
  permission: string,
  resource?: Record<string, unknown> | null,
): void {
  if (!can(permission, user, resource)) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Forbidden',
    })
  }
}
