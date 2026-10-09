import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createEvent } from 'h3'

vi.mock('~~/server/utils/auth', () => ({
  requireAuth: vi.fn(),
}))

vi.mock('~~/server/utils/permissions', () => ({
  requirePermission: vi.fn(),
}))

vi.mock('~~/server/services/organizerService', () => ({
  organizerService: {
    moderateProfile: vi.fn(),
  },
}))

// eslint-disable-next-line import/first -- import must follow vi.mock()
import { organizerService } from '~~/server/services/organizerService'
// eslint-disable-next-line import/first -- import must follow vi.mock()
import { requireAuth } from '~~/server/utils/auth'
// eslint-disable-next-line import/first -- import must follow vi.mock()
import { requirePermission } from '~~/server/utils/permissions'

const mockModerateProfile = vi.mocked(organizerService.moderateProfile)
const mockRequireAuth = vi.mocked(requireAuth)
const mockRequirePermission = vi.mocked(requirePermission)

const ADMIN = { id: 'admin-1', role: 'ADMIN', email: 'admin@example.com' }

function makePatchEvent(params: Record<string, string>, body?: unknown) {
  const event = createEvent(
    { url: '/api/admin/test', method: 'PATCH', headers: { 'content-type': 'application/json' } },
    {},
  )
  event.context.params = params
  if (body !== undefined) event._requestBody = JSON.stringify(body)
  return event
}

async function moderate(id: string, body?: unknown) {
  const mod = await import('../../../server/api/admin/organizer-profiles/[id].patch')
  const handler = mod.default as unknown as (_event: unknown) => Promise<unknown>
  return handler(makePatchEvent({ id }, body))
}

/**
 * One route verifies or rejects a profile: `PATCH /api/admin/organizer-profiles/[id]`.
 *
 * A second, narrower `PATCH /api/admin/organizers/[id]/verify` used to do the same thing,
 * and the quick-verify button in the organizers tab called that one. Both delegated to
 * `organizerService.moderateProfile`, so they could not drift — but two surfaces for one
 * domain action is two places to forget one of them. The duplicate is gone; these hold the
 * remaining route to the notification and email behaviour the organizer depends on.
 */
describe('PATCH /api/admin/organizer-profiles/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRequireAuth.mockResolvedValue(ADMIN as never)
    mockModerateProfile.mockResolvedValue({
      id: 'profile-1',
      slug: 'john-doe',
      verificationStatus: 'VERIFIED',
    } as never)
  })

  it('verifies through moderateProfile with ORGANIZER_APPROVED', async () => {
    const result = await moderate('profile-1', { verificationStatus: 'VERIFIED' })

    expect(mockModerateProfile)
      .toHaveBeenCalledWith('profile-1', 'VERIFIED', undefined, 'ORGANIZER_APPROVED')
    expect(result).toEqual({
      id: 'profile-1',
      slug: 'john-doe',
      verificationStatus: 'VERIFIED',
    })
  })

  it('routes a rejection through the same service with its reason', async () => {
    await moderate('profile-1', {
      verificationStatus: 'REJECTED',
      rejectionReason: 'Incomplete documents',
    })

    expect(mockModerateProfile).toHaveBeenCalledWith(
      'profile-1',
      'REJECTED',
      'Incomplete documents',
      'ORGANIZER_REJECTED',
    )
  })

  it('gates the action behind a moderation permission, not a read one', async () => {
    await moderate('profile-1', { verificationStatus: 'VERIFIED' })

    expect(mockRequirePermission).toHaveBeenCalledWith(ADMIN, 'admin.profiles.moderate')
  })

  it('rejects a malformed moderation body before touching the service', async () => {
    await expect(
      moderate('profile-1', { verificationStatus: 'MAYBE' }),
    ).rejects.toMatchObject({ statusCode: 400 })

    expect(mockModerateProfile).not.toHaveBeenCalled()
  })

  it('requires a profile id', async () => {
    await expect(moderate('')).rejects.toMatchObject({ statusCode: 400 })

    expect(mockModerateProfile).not.toHaveBeenCalled()
  })
})
