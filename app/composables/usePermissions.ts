import { can as checkPermission } from '~~/shared/utils/permissions'
import type { Permission } from '~~/shared/utils/permissions'

export const usePermissions = () => {
  const { user } = useUser()

  const can = (permission: Permission, resource?: Record<string, unknown> | null): boolean => {
    return checkPermission(permission, user.value, resource)
  }

  return { can }
}
