import { describe, it, expect } from 'vitest'
import { notificationRoute } from '../../shared/utils/notificationRoutes'
import type { Notification } from '../../types'

function makeNotification(overrides: Partial<Notification> = {}): Notification {
  return {
    id: 'n-1',
    type: 'APPLICATION_APPROVED',
    entityType: 'group',
    entityId: 'support-group',
    title: 'Title',
    message: 'Body',
    read: false,
    createdAt: '2026-10-29T12:00:00.000Z',
    ...overrides,
  }
}

/**
 * Every route here has to resolve. A notification is the one link a user clicks without
 * looking at the address bar first, so a wrong `entityId` or a wrong branch is a 404 they
 * cannot diagnose — which is what both regressions below were.
 */
describe('notificationRoute', () => {
  it('sends the organizer to the queue of the group an application arrived for', () => {
    expect(notificationRoute(makeNotification({ type: 'APPLICATION_RECEIVED' }), 'ua', 'ORGANIZER'))
      .toBe('/ua/groups/applications/support-group')
  })

  it.each(['APPLICATION_SUBMITTED', 'APPLICATION_APPROVED', 'APPLICATION_REJECTED'])(
    'links %s to the group page by slug, not by id',
    (type) => {
      expect(notificationRoute(makeNotification({ type }), 'en', 'VISITOR'))
        .toBe('/en/groups/support-group')
    },
  )

  it('links a group lifecycle notification to the public group page', () => {
    expect(notificationRoute(makeNotification({ type: 'GROUP_PUBLISHED' }), 'ua', 'ORGANIZER'))
      .toBe('/ua/groups/support-group')
  })

  it('sends an admin to the panel for a profile awaiting verification', () => {
    const n = makeNotification({
      type: 'ORGANIZER_PENDING_REVIEW',
      entityType: 'organizerProfile',
      entityId: 'olena-kovalenko',
    })

    expect(notificationRoute(n, 'ua', 'ADMIN')).toBe('/ua/admin')
  })

  it('sends the organizer behind a pending profile to their own profile, not the panel', () => {
    const n = makeNotification({
      type: 'ORGANIZER_PENDING_REVIEW',
      entityType: 'organizerProfile',
      entityId: 'olena-kovalenko',
    })

    expect(notificationRoute(n, 'ua', 'ORGANIZER')).toBe('/ua/profile')
  })

  it('links a welcome notification to the profile, which is unpublished until verified', () => {
    const n = makeNotification({
      type: 'ORGANIZER_WELCOME',
      entityType: 'organizerProfile',
      entityId: 'olena-kovalenko',
    })

    expect(notificationRoute(n, 'ua', 'ORGANIZER')).toBe('/ua/profile')
  })

  it('links a rejected profile to the editor, because its public page answers 404', () => {
    // `organizers/[slug].get` hides every profile that is not VERIFIED, so the generic
    // organizerProfile branch below sent the owner to a 404 for the one notification that
    // asks them to change something. The editor shows the reason and a save re-queues it.
    const n = makeNotification({
      type: 'ORGANIZER_REJECTED',
      entityType: 'organizerProfile',
      entityId: 'olena-kovalenko',
    })

    expect(notificationRoute(n, 'ua', 'ORGANIZER')).toBe('/ua/profile/edit')
  })

  it('links a verified profile to the public organizer page', () => {
    const n = makeNotification({
      type: 'ORGANIZER_APPROVED',
      entityType: 'organizerProfile',
      entityId: 'olena-kovalenko',
    })

    expect(notificationRoute(n, 'en', 'ORGANIZER')).toBe('/en/organizers/olena-kovalenko')
  })

  it('gives no link to a notification about an entity there is no page for', () => {
    const n = makeNotification({
      type: 'APPLICATION_WITHDRAWN',
      entityType: 'application',
      entityId: 'app-1',
    })

    expect(notificationRoute(n, 'ua', 'ORGANIZER')).toBeNull()
  })
})
