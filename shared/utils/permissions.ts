export type Role = 'ADMIN' | 'ORGANIZER' | 'VISITOR'

export interface PermissionContext {
  user: { id: string, role: string } | null
  resource?: Record<string, unknown> | null
}

type PermissionCheck = (_ctx: PermissionContext) => boolean

/** Map of permission keys to their check functions, defining all authorization rules for the application. */
export const permissions: Record<string, PermissionCheck> = {
  // Admin panel
  'admin.panel': ctx => ctx.user?.role === 'ADMIN',
  'admin.groups.moderate': ctx => ctx.user?.role === 'ADMIN',
  'admin.profiles.moderate': ctx => ctx.user?.role === 'ADMIN',
  'admin.applications.view': ctx => ctx.user?.role === 'ADMIN',
  'admin.users.view': ctx => ctx.user?.role === 'ADMIN',
  'admin.organizers.view': ctx => ctx.user?.role === 'ADMIN',

  // Groups
  'group.view': (ctx) => {
    if (!ctx.resource) return false
    if ((ctx.resource as Record<string, unknown>).status === 'PUBLISHED') return true
    if (ctx.user?.role === 'ADMIN') return true
    if (!ctx.user) return false
    if ((ctx.resource as Record<string, unknown>).organizerUserId === ctx.user.id) return true
    const coOrganizerUserIds = (ctx.resource as Record<string, unknown>).coOrganizerUserIds
    if (Array.isArray(coOrganizerUserIds) && coOrganizerUserIds.includes(ctx.user.id)) return true
    return false
  },
  'group.create': ctx => ctx.user?.role === 'ADMIN' || ctx.user?.role === 'ORGANIZER',
  'group.edit': (ctx) => {
    if (ctx.user?.role === 'ADMIN') return true
    if (!ctx.resource) return false
    if ((ctx.resource as Record<string, unknown>).organizerUserId === ctx.user?.id) return true
    const coOrganizerUserIds = (ctx.resource as Record<string, unknown>).coOrganizerUserIds
    if (Array.isArray(coOrganizerUserIds) && coOrganizerUserIds.includes(ctx.user?.id)) return true
    return false
  },
  'group.delete': (ctx) => {
    if (ctx.user?.role === 'ADMIN') return true
    if (ctx.user?.role === 'ORGANIZER' && ctx.resource) {
      return (ctx.resource as Record<string, unknown>).organizerUserId === ctx.user.id
    }
    return false
  },
  'group.publish': ctx => ctx.user?.role === 'ADMIN',
  'group.viewMyList': ctx => ctx.user?.role === 'ORGANIZER',

  // Favorites — any authenticated user
  'favorite.manage': ctx => !!ctx.user,

  // Applications
  'application.create': ctx => !!ctx.user,
  'application.manage': (ctx) => {
    if (ctx.user?.role === 'ADMIN') return true
    if (ctx.user?.role === 'ORGANIZER' && ctx.resource) {
      return (ctx.resource as Record<string, unknown>).groupOrganizerUserId === ctx.user.id
    }
    return false
  },
  'application.viewMyApplications': ctx => ctx.user?.role === 'ORGANIZER' || ctx.user?.role === 'VISITOR',

  // User profile (basic — for all authenticated users)
  'user.profile.view': _ctx => !!_ctx.user,

  // Organizer profile (extended — for ORGANIZER/ADMIN only)
  'organizer.profile.edit': ctx => ctx.user?.role === 'ORGANIZER' || ctx.user?.role === 'ADMIN',
  'organizer.profile.moderate': ctx => ctx.user?.role === 'ADMIN',

  // Notifications
  'notification.manage': ctx => !!ctx.user,
}

export type Permission = keyof typeof permissions

/**
 * Evaluates whether a user has a specific permission, optionally scoped to a resource.
 * Returns false for unknown permission keys rather than throwing.
 * @param permission - The permission key to check (e.g. 'group.edit', 'admin.panel')
 * @param user - The user object with id and role, or null for unauthenticated access
 * @param resource - Optional resource context for ownership-based permission checks
 * @returns True if the user has the permission, false otherwise
 */
export const can = (permission: string, user: { id: string, role: string } | null, resource?: Record<string, unknown> | null): boolean => {
  const check = permissions[permission]
  if (!check) return false
  return check({ user, resource })
}
