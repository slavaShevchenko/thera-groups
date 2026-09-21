export type Role = 'ADMIN' | 'ORGANIZER' | 'VISITOR'

export interface PermissionContext {
  user: { id: string, role: string } | null
  resource?: Record<string, unknown> | null
}

type PermissionCheck = (_ctx: PermissionContext) => boolean

function getOrganizerUserId(resource: Record<string, unknown> | null | undefined): string | undefined {
  if (!resource) return undefined
  if (typeof resource.organizerUserId === 'string') return resource.organizerUserId
  const organizer = resource.organizer as Record<string, unknown> | undefined
  if (organizer && typeof organizer.userId === 'string') return organizer.userId
  return undefined
}

function getCoOrganizerUserIds(resource: Record<string, unknown> | null | undefined): string[] {
  if (!resource) return []
  if (Array.isArray(resource.coOrganizerUserIds)) {
    return resource.coOrganizerUserIds.filter((id): id is string => typeof id === 'string')
  }
  const coOrganizers = resource.coOrganizers as Array<Record<string, unknown>> | undefined
  if (Array.isArray(coOrganizers)) {
    return coOrganizers
      .map(co => co.userId)
      .filter((id): id is string => typeof id === 'string')
  }
  return []
}

function isOwner(ctx: PermissionContext): boolean {
  if (!ctx.user || !ctx.resource) return false
  return getOrganizerUserId(ctx.resource) === ctx.user.id
}

function isOwnerOrCoOrganizer(ctx: PermissionContext): boolean {
  if (!ctx.user) return false
  if (isOwner(ctx)) return true
  const coOrganizerUserIds = getCoOrganizerUserIds(ctx.resource)
  return coOrganizerUserIds.includes(ctx.user.id)
}

export const permissions = {
  'admin.panel': ctx => ctx.user?.role === 'ADMIN',
  'admin.groups.moderate': ctx => ctx.user?.role === 'ADMIN',
  'admin.profiles.moderate': ctx => ctx.user?.role === 'ADMIN',
  'admin.applications.view': ctx => ctx.user?.role === 'ADMIN',
  'admin.users.view': ctx => ctx.user?.role === 'ADMIN',
  'admin.organizers.view': ctx => ctx.user?.role === 'ADMIN',

  'group.view': (ctx) => {
    if (!ctx.resource) return false
    if ((ctx.resource as Record<string, unknown>).status === 'PUBLISHED') return true
    if (ctx.user?.role === 'ADMIN') return true
    return isOwnerOrCoOrganizer(ctx)
  },
  'group.create': ctx => ctx.user?.role === 'ADMIN' || ctx.user?.role === 'ORGANIZER',
  'group.edit': (ctx) => {
    if (ctx.user?.role === 'ADMIN') return true
    return isOwnerOrCoOrganizer(ctx)
  },
  'group.delete': (ctx) => {
    if (ctx.user?.role === 'ADMIN') return true
    return isOwner(ctx)
  },
  'group.publish': ctx => ctx.user?.role === 'ADMIN',
  'group.moderate': ctx => ctx.user?.role === 'ADMIN',
  'group.viewMyList': ctx => ctx.user?.role === 'ORGANIZER' || ctx.user?.role === 'ADMIN',

  'favorite.manage': ctx => !!ctx.user,

  'application.create': (_ctx) => {
    return true
  },
  'application.viewOwn': ctx => !!ctx.user,
  'application.viewForGroup': (ctx) => {
    if (ctx.user?.role === 'ADMIN') return true
    return isOwnerOrCoOrganizer(ctx)
  },
  'application.manage': (ctx) => {
    if (ctx.user?.role === 'ADMIN') return true
    if (!ctx.user || !ctx.resource) return false
    const organizerUserId = (ctx.resource as Record<string, unknown>).groupOrganizerUserId
    return typeof organizerUserId === 'string' && organizerUserId === ctx.user.id
  },

  'user.profile.view': _ctx => !!_ctx.user,

  'organizer.profile.view': (ctx) => {
    if (ctx.resource?.verificationStatus === 'VERIFIED') return true
    if (!ctx.user) return false
    if (ctx.user.role === 'ADMIN') return true
    return isOwner(ctx)
  },
  'organizer.profile.edit': ctx => ctx.user?.role === 'ORGANIZER' || ctx.user?.role === 'ADMIN',
  'organizer.profile.moderate': ctx => ctx.user?.role === 'ADMIN',

  'notification.manage': ctx => !!ctx.user,
} as const satisfies Record<string, PermissionCheck>

export type Permission = keyof typeof permissions

export const can = (
  permission: Permission,
  user: { id: string, role: string } | null,
  resource?: Record<string, unknown> | null,
): boolean => {
  const check = permissions[permission]
  if (!check) return false
  return check({ user, resource })
}
