import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createEvent } from 'h3'

vi.mock('~~/server/utils/auth', () => ({
  requireAuth: vi.fn(),
}))

vi.mock('~~/server/utils/permissions', () => ({
  requirePermission: vi.fn(),
}))

vi.mock('~~/server/utils/prisma', () => ({ prisma: globalThis.prisma }))

// eslint-disable-next-line import/first -- import must follow vi.mock()
import { requireAuth } from '~~/server/utils/auth'
// eslint-disable-next-line import/first -- import must follow vi.mock()
import { requirePermission } from '~~/server/utils/permissions'

const mockRequireAuth = vi.mocked(requireAuth)
const mockRequirePermission = vi.mocked(requirePermission)

const ADMIN = { id: 'admin-1', role: 'ADMIN', email: 'admin@example.com', isActive: true }

// Throwing here stops every handler on the line after its permission check, so the test
// asserts the gate itself and never needs the repositories behind it.
const STOP = new Error('permission-checked')

type Handler = (_event: unknown) => Promise<unknown>

const ADMIN_ROUTES = [
  {
    name: 'deactivate/activate an organizer',
    load: async () => (await import('../../../server/api/admin/organizers/[id]/toggle-active.patch')).default as unknown as Handler,
    method: 'PATCH',
    url: '/api/admin/organizers/profile-1/toggle-active',
    params: { id: 'profile-1' },
    permission: 'admin.organizers.moderate',
  },
  {
    name: 'list organizers',
    load: async () => (await import('../../../server/api/admin/organizers.get')).default as unknown as Handler,
    method: 'GET',
    url: '/api/admin/organizers?page=1&limit=20',
    params: undefined,
    permission: 'admin.organizers.view',
  },
  {
    name: 'list groups',
    load: async () => (await import('../../../server/api/admin/groups.get')).default as unknown as Handler,
    method: 'GET',
    url: '/api/admin/groups?page=1&limit=20',
    params: undefined,
    permission: 'admin.groups.view',
  },
  {
    name: 'moderate a group',
    load: async () => (await import('../../../server/api/admin/groups/[id].patch')).default as unknown as Handler,
    method: 'PATCH',
    url: '/api/admin/groups/group-1',
    params: { id: 'group-1' },
    permission: 'admin.groups.moderate',
  },
  {
    name: 'list profiles pending verification',
    load: async () => (await import('../../../server/api/admin/organizer-profiles/pending.get')).default as unknown as Handler,
    method: 'GET',
    url: '/api/admin/organizer-profiles/pending',
    params: undefined,
    permission: 'admin.profiles.view',
  },
  {
    name: 'moderate a profile',
    load: async () => (await import('../../../server/api/admin/organizer-profiles/[id].patch')).default as unknown as Handler,
    method: 'PATCH',
    url: '/api/admin/organizer-profiles/profile-1',
    params: { id: 'profile-1' },
    permission: 'admin.profiles.moderate',
  },
  {
    name: 'list users',
    load: async () => (await import('../../../server/api/admin/users.get')).default as unknown as Handler,
    method: 'GET',
    url: '/api/admin/users?page=1&limit=20',
    params: undefined,
    permission: 'admin.users.view',
  },
  {
    name: 'list applications',
    load: async () => (await import('../../../server/api/admin/applications.get')).default as unknown as Handler,
    method: 'GET',
    url: '/api/admin/applications?page=1&limit=20',
    params: undefined,
    permission: 'admin.applications.view',
  },
]

/**
 * Which permission each admin route demands.
 *
 * Reads must sit behind a `*.view` key and writes behind a `*.moderate` key. The mapping
 * used to be wrong in both directions at once: deactivation — which locks an organizer out
 * of everything they own — was reachable with the key that only lists them, while two list
 * endpoints demanded a moderation key.
 */
describe('admin routes demand the permission that matches the action', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRequireAuth.mockResolvedValue(ADMIN as never)
    mockRequirePermission.mockImplementation(() => {
      throw STOP
    })
  })

  it.each(ADMIN_ROUTES)('$name → $permission', async (route) => {
    const event = createEvent({ url: route.url, method: route.method, headers: {} }, {})
    if (route.params) event.context.params = { ...route.params }

    await expect((await route.load())(event)).rejects.toBe(STOP)
    expect(mockRequirePermission).toHaveBeenCalledWith(ADMIN, route.permission)
  })
})
