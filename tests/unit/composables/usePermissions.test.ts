import { describe, it, expect, vi, beforeEach } from 'vitest'
import { usePermissions } from '~/composables/usePermissions'

vi.mock('#app', () => ({
  useState: (key: string, init: () => unknown) => ({ value: init() }),
}))

const mockUser = vi.fn()

vi.mock('~/composables/useUser', () => ({
  useUser: () => ({ user: { value: mockUser() } }),
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('usePermissions', () => {
  it('returns false when user is null', () => {
    mockUser.mockReturnValue(null)
    const { can } = usePermissions()
    expect(can('group.create')).toBe(false)
  })

  it('returns false for VISITOR trying to create a group', () => {
    mockUser.mockReturnValue({ id: '1', role: 'VISITOR' })
    const { can } = usePermissions()
    expect(can('group.create')).toBe(false)
  })

  it('returns false for ORGANIZER with UNVERIFIED profile trying to create a group', () => {
    mockUser.mockReturnValue({
      id: '1',
      role: 'ORGANIZER',
      organizerProfile: { verificationStatus: 'UNVERIFIED' },
    })
    const { can } = usePermissions()
    expect(can('group.create')).toBe(false)
  })

  it('returns true for ORGANIZER with VERIFIED profile creating a group', () => {
    mockUser.mockReturnValue({
      id: '1',
      role: 'ORGANIZER',
      organizerProfile: { verificationStatus: 'VERIFIED' },
    })
    const { can } = usePermissions()
    expect(can('group.create')).toBe(true)
  })

  it('returns true for ADMIN creating a group regardless of profile', () => {
    mockUser.mockReturnValue({ id: '1', role: 'ADMIN' })
    const { can } = usePermissions()
    expect(can('group.create')).toBe(true)
  })

  it('returns true for group owner editing their group', () => {
    mockUser.mockReturnValue({ id: 'owner-1', role: 'ORGANIZER' })
    const { can } = usePermissions()
    expect(can('group.edit', { organizerUserId: 'owner-1' })).toBe(true)
  })

  it('returns true for co-organizer editing a group', () => {
    mockUser.mockReturnValue({ id: 'co-1', role: 'ORGANIZER' })
    const { can } = usePermissions()
    expect(can('group.edit', { organizerUserId: 'owner-1', coOrganizerUserIds: ['co-1'] })).toBe(true)
  })

  it('returns false for non-owner non-co-organizer editing a group', () => {
    mockUser.mockReturnValue({ id: 'other-1', role: 'ORGANIZER' })
    const { can } = usePermissions()
    expect(can('group.edit', { organizerUserId: 'owner-1', coOrganizerUserIds: ['co-1'] })).toBe(false)
  })

  it('returns true for ADMIN editing any group', () => {
    mockUser.mockReturnValue({ id: 'admin-1', role: 'ADMIN' })
    const { can } = usePermissions()
    expect(can('group.edit', { organizerUserId: 'owner-1' })).toBe(true)
  })

  it('returns false for co-organizer deleting a group', () => {
    mockUser.mockReturnValue({ id: 'co-1', role: 'ORGANIZER' })
    const { can } = usePermissions()
    expect(can('group.delete', { organizerUserId: 'owner-1', coOrganizerUserIds: ['co-1'] })).toBe(false)
  })

  it('returns true for owner deleting their group', () => {
    mockUser.mockReturnValue({ id: 'owner-1', role: 'ORGANIZER' })
    const { can } = usePermissions()
    expect(can('group.delete', { organizerUserId: 'owner-1' })).toBe(true)
  })

  it('returns false for non-admin trying to publish a group', () => {
    mockUser.mockReturnValue({ id: '1', role: 'ORGANIZER' })
    const { can } = usePermissions()
    expect(can('group.publish')).toBe(false)
  })

  it('returns true for ADMIN publishing a group', () => {
    mockUser.mockReturnValue({ id: '1', role: 'ADMIN' })
    const { can } = usePermissions()
    expect(can('group.publish')).toBe(true)
  })

  it('returns true for any authenticated user creating an application', () => {
    mockUser.mockReturnValue({ id: '1', role: 'VISITOR' })
    const { can } = usePermissions()
    expect(can('application.create')).toBe(true)
  })

  it('returns true for unauthenticated user creating an application', () => {
    mockUser.mockReturnValue(null)
    const { can } = usePermissions()
    expect(can('application.create')).toBe(true)
  })

  it('returns false for non-admin accessing admin panel', () => {
    mockUser.mockReturnValue({ id: '1', role: 'ORGANIZER' })
    const { can } = usePermissions()
    expect(can('admin.panel')).toBe(false)
  })

  it('returns true for ADMIN accessing admin panel', () => {
    mockUser.mockReturnValue({ id: '1', role: 'ADMIN' })
    const { can } = usePermissions()
    expect(can('admin.panel')).toBe(true)
  })

  it('returns false for deactivated organizer profile view', () => {
    mockUser.mockReturnValue({ id: '1', role: 'VISITOR' })
    const { can } = usePermissions()
    expect(can('organizer.profile.view', { isActive: false, verificationStatus: 'VERIFIED' })).toBe(false)
  })

  it('returns true for VERIFIED organizer profile view by anyone', () => {
    mockUser.mockReturnValue(null)
    const { can } = usePermissions()
    expect(can('organizer.profile.view', { verificationStatus: 'VERIFIED' })).toBe(true)
  })

  it('returns false for unknown permission', () => {
    mockUser.mockReturnValue({ id: '1', role: 'ADMIN' })
    const { can } = usePermissions()
    expect(can('nonexistent.permission' as never)).toBe(false)
  })
})
