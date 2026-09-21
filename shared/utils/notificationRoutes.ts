import type { Notification } from '~~/types'

export function notificationRoute(
  n: Notification,
  locale: string,
  userRole?: string,
): string | null {
  if (n.type === 'APPLICATION_RECEIVED' && n.entityType === 'group') {
    return `/${locale}/groups/applications/${n.entityId}`
  }
  if (n.type === 'ORGANIZER_PENDING_REVIEW') {
    if (userRole === 'ADMIN') {
      return `/${locale}/admin`
    }
    return `/${locale}/profile`
  }
  if (n.entityType === 'group') {
    return `/${locale}/groups/${n.entityId}`
  }
  if (n.entityType === 'organizerProfile') {
    return `/${locale}/organizers/${n.entityId}`
  }
  return null
}
