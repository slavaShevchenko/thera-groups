import { can as checkPermission } from '~~/shared/utils/permissions'

export const usePermissions = () => {
  const { user } = useUser()

  const can = (permission: string, resource?: Record<string, unknown> | null): boolean => {
    return checkPermission(permission, user.value, resource)
  }

  return { can }
}
