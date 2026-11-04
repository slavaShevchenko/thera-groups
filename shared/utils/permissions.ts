export type Role = 'ADMIN' | 'ORGANIZER' | 'VISITOR'

export interface PermissionContext {
  user: { id: string, role: string, organizerProfile?: { verificationStatus?: string } | null } | null
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

/**
 * Whether the caller runs this group's applications: its owner, one of its co-organizers,
 * or an admin.
 *
 * One function behind both application keys, because they answer the same question from
 * two directions — who may open the queue, and who may act on what is in it. Keeping them
 * separate is what let `manage` refuse a co-organizer the queue had just been shown to.
 *
 * Two spellings of "who owns this group" are accepted: `groupOrganizerUserId`, which the
 * application endpoints pass because their resource is an application rather than a group,
 * and the plain group shape `isOwnerOrCoOrganizer` reads.
 */
function managesApplications(ctx: PermissionContext): boolean {
  if (ctx.user?.role === 'ADMIN') return true
  if (!ctx.user || !ctx.resource) return false

  const groupOrganizerUserId = ctx.resource.groupOrganizerUserId
  if (typeof groupOrganizerUserId === 'string' && groupOrganizerUserId === ctx.user.id) return true

  return isOwnerOrCoOrganizer(ctx)
}

export const permissions = {
  'admin.panel': ctx => ctx.user?.role === 'ADMIN',
  'admin.groups.view': ctx => ctx.user?.role === 'ADMIN',
  'admin.groups.moderate': ctx => ctx.user?.role === 'ADMIN',
  'admin.profiles.view': ctx => ctx.user?.role === 'ADMIN',
  'admin.profiles.moderate': ctx => ctx.user?.role === 'ADMIN',
  'admin.applications.view': ctx => ctx.user?.role === 'ADMIN',
  'admin.users.view': ctx => ctx.user?.role === 'ADMIN',
  'admin.organizers.view': ctx => ctx.user?.role === 'ADMIN',
  // Destructive: deactivating an organizer locks them out of everything they own.
  // Reading the list must not be enough to do it.
  'admin.organizers.moderate': ctx => ctx.user?.role === 'ADMIN',

  'group.view': (ctx) => {
    if (!ctx.resource) return false
    if ((ctx.resource as Record<string, unknown>).status === 'PUBLISHED') return true
    if (ctx.user?.role === 'ADMIN') return true
    return isOwnerOrCoOrganizer(ctx)
  },
  'group.create': (ctx) => {
    if (ctx.user?.role === 'ADMIN') return true
    if (ctx.user?.role !== 'ORGANIZER') return false
    return ctx.user.organizerProfile?.verificationStatus === 'VERIFIED'
  },
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
  'application.viewForGroup': managesApplications,
  'application.manage': managesApplications,

  'user.profile.view': _ctx => !!_ctx.user,

  'organizer.profile.view': (ctx) => {
    // A ban outranks verification and outranks the ADMIN bypass: a deactivated user has
    // no public profile at all, so the page must not resolve for a slug that still exists.
    // Checked against `false` and not against a missing field, because most resources
    // describing a profile were never asked to carry `isActive` — an absent value is not a
    // ban. Admins inspect blocked accounts through `admin.organizers.view`, which lists
    // `isActive` per row, rather than through the public page.
    if (ctx.resource?.isActive === false) return false
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
  user: { id: string, role: string, organizerProfile?: { verificationStatus?: string } | null } | null,
  resource?: Record<string, unknown> | null,
): boolean => {
  const check = permissions[permission]
  if (!check) return false
  return check({ user, resource })
}
