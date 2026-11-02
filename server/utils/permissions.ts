import { can } from '~~/shared/utils/permissions'
import type { Permission } from '~~/shared/utils/permissions'
import type { User } from '@prisma/client'
import { ErrorCodes } from './errorCodes'

export function requirePermission(
  user: User,
  permission: Permission,
  resource?: Record<string, unknown> | null,
): void {
  if (!can(permission, user, resource)) {
    // Carries the trusted code like every other 403 in the API. Without it this was the
    // only refusal that reached the client as `{ statusCode: 403 }` with no `data.code`,
    // so a caller branching on the code could not tell it from a sanitized 500.
    throw createError({
      statusCode: 403,
      statusMessage: 'Forbidden',
      data: { code: ErrorCodes.FORBIDDEN },
    })
  }
}
