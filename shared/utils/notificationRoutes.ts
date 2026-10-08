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
  // A welcome notification is about the reader's own profile, which stays unpublished until
  // a moderator verifies it — so it links to the private editor, not the organizer page.
  if (n.type === 'ORGANIZER_WELCOME') {
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
