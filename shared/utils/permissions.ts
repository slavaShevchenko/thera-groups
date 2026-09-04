export type Role = 'ADMIN' | 'ORGANIZER' | 'VISITOR'

export interface PermissionContext {
  user: { id: string, role: string } | null
  resource?: Record<string, unknown> | null
}

type PermissionCheck = (_ctx: PermissionContext) => boolean

export const permissions: Record<string, PermissionCheck> = {
  // Admin panel
  'admin.panel': ctx => ctx.user?.role === 'ADMIN',
  'admin.groups.moderate': ctx => ctx.user?.role === 'ADMIN',
  'admin.profiles.moderate': ctx => ctx.user?.role === 'ADMIN',
  'admin.applications.view': ctx => ctx.user?.role === 'ADMIN',
  'admin.users.view': ctx => ctx.user?.role === 'ADMIN',
  'admin.organizers.view': ctx => ctx.user?.role === 'ADMIN',

  // Groups
  'group.create': ctx => ctx.user?.role === 'ADMIN' || ctx.user?.role === 'ORGANIZER',
  'group.edit': (ctx) => {
    if (ctx.user?.role === 'ADMIN') return true
    if (ctx.user?.role === 'ORGANIZER' && ctx.resource) {
      return (ctx.resource as Record<string, unknown>).organizerUserId === ctx.user.id
    }
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
  'group.viewMyList': ctx => ctx.user?.role === 'ADMIN' || ctx.user?.role === 'ORGANIZER',

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

  // Organizer profile
  'organizer.profile.edit': ctx => !!ctx.user,
  'organizer.profile.moderate': ctx => ctx.user?.role === 'ADMIN',

  // Notifications
  'notification.manage': ctx => !!ctx.user,
}

export type Permission = keyof typeof permissions

export const can = (permission: string, user: { id: string, role: string } | null, resource?: Record<string, unknown> | null): boolean => {
  const check = permissions[permission]
  if (!check) return false
  return check({ user, resource })
}
