import { describe, it, expect } from 'vitest'
import { can } from '../../shared/utils/permissions'

const admin = { id: 'admin-1', role: 'ADMIN' }
const organizer = { id: 'org-1', role: 'ORGANIZER' }
const visitor = { id: 'vis-1', role: 'VISITOR' }
const otherOrganizer = { id: 'org-2', role: 'ORGANIZER' }

describe('permissions — can()', () => {
  describe('unknown permission', () => {
    it('returns false for unknown permission', () => {
      expect(can('nonexistent.permission' as never, admin)).toBe(false)
    })
  })

  describe('admin.panel', () => {
    it('allows admin', () => {
      expect(can('admin.panel', admin)).toBe(true)
    })

    it('denies organizer', () => {
      expect(can('admin.panel', organizer)).toBe(false)
    })

    it('denies visitor', () => {
      expect(can('admin.panel', visitor)).toBe(false)
    })

    it('denies null user', () => {
      expect(can('admin.panel', null)).toBe(false)
    })
  })

  describe('admin.groups.moderate', () => {
    it('allows admin', () => {
      expect(can('admin.groups.moderate', admin)).toBe(true)
    })

    it('denies organizer', () => {
      expect(can('admin.groups.moderate', organizer)).toBe(false)
    })
  })

  /**
   * Every admin key is ADMIN-only, and each action has its own key so a read permission
   * can never authorise a write. `admin.organizers.moderate` is the one that matters most:
   * deactivating an organizer is destructive, and it used to sit behind the key that only
   * lists them.
   */
  describe('admin view/moderate keys', () => {
    const adminKeys = [
      'admin.groups.view',
      'admin.groups.moderate',
      'admin.profiles.view',
      'admin.profiles.moderate',
      'admin.applications.view',
      'admin.users.view',
      'admin.organizers.view',
      'admin.organizers.moderate',
    ] as const

    it.each(adminKeys)('%s allows admin only', (key) => {
      expect(can(key, admin)).toBe(true)
      expect(can(key, organizer)).toBe(false)
      expect(can(key, visitor)).toBe(false)
      expect(can(key, null)).toBe(false)
    })

    it('exposes deactivation as its own permission, not the list one', () => {
      expect(adminKeys).toContain('admin.organizers.moderate')
      expect(can('admin.organizers.moderate', admin)).toBe(true)
    })
  })

  describe('group.create', () => {
    it('allows admin', () => {
      expect(can('group.create', admin)).toBe(true)
    })

    it('allows verified organizer', () => {
      const verified = { id: 'org-1', role: 'ORGANIZER', organizerProfile: { verificationStatus: 'VERIFIED' } }
      expect(can('group.create', verified)).toBe(true)
    })

    it('denies unverified organizer without profile', () => {
      expect(can('group.create', organizer)).toBe(false)
    })

    it('denies unverified organizer with pending status', () => {
      const pending = { id: 'org-1', role: 'ORGANIZER', organizerProfile: { verificationStatus: 'PENDING' } }
      expect(can('group.create', pending)).toBe(false)
    })

    it('denies visitor', () => {
      expect(can('group.create', visitor)).toBe(false)
    })

    it('denies null user', () => {
      expect(can('group.create', null)).toBe(false)
    })
  })

  describe('group.view', () => {
    it('allows anyone to view published group', () => {
      const resource = { status: 'PUBLISHED', organizerUserId: 'org-1' }
      expect(can('group.view', null, resource)).toBe(true)
      expect(can('group.view', visitor, resource)).toBe(true)
    })

    it('allows admin to view any group', () => {
      const resource = { status: 'DRAFT', organizerUserId: 'org-1' }
      expect(can('group.view', admin, resource)).toBe(true)
    })

    it('allows admin to view FULL/COMPLETED/CANCELLED groups', () => {
      for (const status of ['FULL', 'COMPLETED', 'CANCELLED']) {
        const resource = { status, organizerUserId: 'org-1' }
        expect(can('group.view', admin, resource)).toBe(true)
      }
    })

    it('allows owner to view own draft', () => {
      const resource = { status: 'DRAFT', organizerUserId: 'org-1' }
      expect(can('group.view', organizer, resource)).toBe(true)
    })

    it('denies visitor from viewing draft', () => {
      const resource = { status: 'DRAFT', organizerUserId: 'org-1' }
      expect(can('group.view', visitor, resource)).toBe(false)
    })

    it('denies other organizer from viewing draft', () => {
      const resource = { status: 'DRAFT', organizerUserId: 'org-1' }
      expect(can('group.view', otherOrganizer, resource)).toBe(false)
    })

    it('allows co-organizer to view non-published group', () => {
      const resource = { status: 'DRAFT', organizerUserId: 'org-1', coOrganizerUserIds: ['org-2'] }
      expect(can('group.view', otherOrganizer, resource)).toBe(true)
    })

    it('allows co-organizer via nested organizer shape', () => {
      const resource = { status: 'DRAFT', organizer: { userId: 'org-1' }, coOrganizers: [{ userId: 'org-2' }] }
      expect(can('group.view', otherOrganizer, resource)).toBe(true)
    })

    it('returns false without resource', () => {
      expect(can('group.view', admin)).toBe(false)
      expect(can('group.view', admin, null)).toBe(false)
    })
  })

  describe('group.edit', () => {
    it('allows admin to edit any group', () => {
      const resource = { organizerUserId: 'org-1' }
      expect(can('group.edit', admin, resource)).toBe(true)
    })

    it('allows owner to edit own group', () => {
      const resource = { organizerUserId: 'org-1' }
      expect(can('group.edit', organizer, resource)).toBe(true)
    })

    it('denies other organizer', () => {
      const resource = { organizerUserId: 'org-1' }
      expect(can('group.edit', otherOrganizer, resource)).toBe(false)
    })

    it('allows co-organizer to edit', () => {
      const resource = { organizerUserId: 'org-1', coOrganizerUserIds: ['org-2'] }
      expect(can('group.edit', otherOrganizer, resource)).toBe(true)
    })

    it('denies without resource', () => {
      expect(can('group.edit', organizer)).toBe(false)
    })

    it('denies visitor with non-matching resource', () => {
      const resource = { organizerUserId: 'org-1' }
      expect(can('group.edit', visitor, resource)).toBe(false)
    })
  })

  describe('group.delete', () => {
    it('allows admin', () => {
      const resource = { organizerUserId: 'org-1' }
      expect(can('group.delete', admin, resource)).toBe(true)
    })

    it('allows owner organizer', () => {
      const resource = { organizerUserId: 'org-1' }
      expect(can('group.delete', organizer, resource)).toBe(true)
    })

    it('denies other organizer', () => {
      const resource = { organizerUserId: 'org-1' }
      expect(can('group.delete', otherOrganizer, resource)).toBe(false)
    })

    it('denies co-organizer (only owner or admin can delete)', () => {
      const resource = { organizerUserId: 'org-1', coOrganizerUserIds: ['org-2'] }
      expect(can('group.delete', otherOrganizer, resource)).toBe(false)
    })
  })

  describe('group.publish', () => {
    it('allows admin only', () => {
      expect(can('group.publish', admin)).toBe(true)
      expect(can('group.publish', organizer)).toBe(false)
      expect(can('group.publish', visitor)).toBe(false)
    })
  })

  describe('group.moderate', () => {
    it('allows admin only', () => {
      expect(can('group.moderate', admin)).toBe(true)
      expect(can('group.moderate', organizer)).toBe(false)
    })
  })

  describe('group.viewMyList', () => {
    it('allows organizer', () => {
      expect(can('group.viewMyList', organizer)).toBe(true)
    })

    it('allows admin', () => {
      expect(can('group.viewMyList', admin)).toBe(true)
    })

    it('denies visitor', () => {
      expect(can('group.viewMyList', visitor)).toBe(false)
    })
  })

  describe('favorite.manage', () => {
    it('allows any authenticated user', () => {
      expect(can('favorite.manage', admin)).toBe(true)
      expect(can('favorite.manage', organizer)).toBe(true)
      expect(can('favorite.manage', visitor)).toBe(true)
    })

    it('denies null user', () => {
      expect(can('favorite.manage', null)).toBe(false)
    })
  })

  describe('application.create', () => {
    it('allows any user including unauthenticated', () => {
      expect(can('application.create', visitor)).toBe(true)
      expect(can('application.create', organizer)).toBe(true)
      expect(can('application.create', null)).toBe(true)
    })
  })

  describe('application.viewOwn', () => {
    it('allows any authenticated user', () => {
      expect(can('application.viewOwn', organizer)).toBe(true)
      expect(can('application.viewOwn', visitor)).toBe(true)
      expect(can('application.viewOwn', admin)).toBe(true)
    })

    it('denies null user', () => {
      expect(can('application.viewOwn', null)).toBe(false)
    })
  })

  describe('application.viewForGroup', () => {
    it('allows admin', () => {
      const resource = { organizerUserId: 'org-1' }
      expect(can('application.viewForGroup', admin, resource)).toBe(true)
    })

    it('allows group owner', () => {
      const resource = { organizerUserId: 'org-1' }
      expect(can('application.viewForGroup', organizer, resource)).toBe(true)
    })

    it('allows co-organizer', () => {
      const resource = { organizerUserId: 'org-1', coOrganizerUserIds: ['org-2'] }
      expect(can('application.viewForGroup', otherOrganizer, resource)).toBe(true)
    })

    it('denies other organizer', () => {
      const resource = { organizerUserId: 'org-1' }
      expect(can('application.viewForGroup', otherOrganizer, resource)).toBe(false)
    })
  })

  describe('application.manage', () => {
    it('allows admin', () => {
      const resource = { groupOrganizerUserId: 'org-1' }
      expect(can('application.manage', admin, resource)).toBe(true)
    })

    it('allows group owner organizer', () => {
      const resource = { groupOrganizerUserId: 'org-1' }
      expect(can('application.manage', organizer, resource)).toBe(true)
    })

    it('denies other organizer', () => {
      const resource = { groupOrganizerUserId: 'org-1' }
      expect(can('application.manage', otherOrganizer, resource)).toBe(false)
    })

    // `viewForGroup` has always admitted co-organizers, so a queue they could read used to
    // be a queue they could not act on: every approve and reject button 403'd under them.
    it('allows a co-organizer, matching who may read the queue', () => {
      const resource = { groupOrganizerUserId: 'org-1', coOrganizerUserIds: ['org-2'] }
      expect(can('application.manage', otherOrganizer, resource)).toBe(true)
    })

    it('allows a co-organizer passed as the raw group shape', () => {
      const resource = {
        organizer: { userId: 'org-1' },
        coOrganizers: [{ userId: 'org-2' }],
      }
      expect(can('application.manage', otherOrganizer, resource)).toBe(true)
    })

    it('denies an organizer who co-organizes a different group', () => {
      const resource = { groupOrganizerUserId: 'org-1', coOrganizerUserIds: ['org-3'] }
      expect(can('application.manage', otherOrganizer, resource)).toBe(false)
    })

    it('agrees with viewForGroup on every caller', () => {
      // The two keys decide who may see the queue and who may act on it. If they ever
      // disagree, the UI renders a button the server refuses.
      const resources = [
        { groupOrganizerUserId: 'org-1', coOrganizerUserIds: ['org-2'] },
        { groupOrganizerUserId: 'org-1', coOrganizerUserIds: [] },
        { organizerUserId: 'org-1', coOrganizerUserIds: ['org-2'] },
      ]

      for (const resource of resources) {
        for (const user of [admin, organizer, otherOrganizer, visitor]) {
          expect(can('application.manage', user, resource))
            .toBe(can('application.viewForGroup', user, resource))
        }
      }
    })

    it('denies visitor', () => {
      const resource = { groupOrganizerUserId: 'org-1' }
      expect(can('application.manage', visitor, resource)).toBe(false)
    })
  })

  describe('organizer.profile.view', () => {
    it('allows anyone to view verified profile', () => {
      const resource = { verificationStatus: 'VERIFIED', organizerUserId: 'org-1' }
      expect(can('organizer.profile.view', null, resource)).toBe(true)
    })

    it('allows owner to view own pending profile', () => {
      const resource = { verificationStatus: 'PENDING', organizerUserId: 'org-1' }
      expect(can('organizer.profile.view', organizer, resource)).toBe(true)
    })

    it('allows admin to view any profile', () => {
      const resource = { verificationStatus: 'PENDING', organizerUserId: 'org-1' }
      expect(can('organizer.profile.view', admin, resource)).toBe(true)
    })

    it('denies visitor from viewing pending profile', () => {
      const resource = { verificationStatus: 'PENDING', organizerUserId: 'org-1' }
      expect(can('organizer.profile.view', visitor, resource)).toBe(false)
    })
  })

  describe('organizer.profile.edit', () => {
    it('allows organizer', () => {
      expect(can('organizer.profile.edit', organizer)).toBe(true)
    })

    it('allows admin', () => {
      expect(can('organizer.profile.edit', admin)).toBe(true)
    })

    it('denies visitor', () => {
      expect(can('organizer.profile.edit', visitor)).toBe(false)
    })
  })

  describe('organizer.profile.moderate', () => {
    it('allows admin only', () => {
      expect(can('organizer.profile.moderate', admin)).toBe(true)
      expect(can('organizer.profile.moderate', organizer)).toBe(false)
      expect(can('organizer.profile.moderate', visitor)).toBe(false)
    })
  })

  describe('notification.manage', () => {
    it('allows any authenticated user', () => {
      expect(can('notification.manage', visitor)).toBe(true)
      expect(can('notification.manage', organizer)).toBe(true)
      expect(can('notification.manage', admin)).toBe(true)
    })

    it('denies null user', () => {
      expect(can('notification.manage', null)).toBe(false)
    })
  })
})
