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

const mockModerateProfile = vi.mocked(organizerService.moderateProfile)
const mockRequireAuth = vi.mocked(requireAuth)

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

async function quickVerify(id: string) {
  const mod = await import('../../../server/api/admin/organizers/[id]/verify.patch')
  const handler = mod.default as unknown as (_event: unknown) => Promise<unknown>
  return handler(makePatchEvent({ id }))
}

async function profileModeration(id: string, body: unknown) {
  const mod = await import('../../../server/api/admin/organizer-profiles/[id].patch')
  const handler = mod.default as unknown as (_event: unknown) => Promise<unknown>
  return handler(makePatchEvent({ id }, body))
}

/**
 * Two admin routes verify the same profile: the quick button in the organizers table and
 * the moderation dialog in the pending-profiles tab. They used to be separate service
 * methods, and only one of them told the organizer anything — which is why verifying from
 * the wrong tab looked like a broken system. Both must now delegate identically.
 */
describe('admin profile verification — both routes are the same action', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRequireAuth.mockResolvedValue(ADMIN as never)
    mockModerateProfile.mockResolvedValue({
      id: 'profile-1',
      slug: 'john-doe',
      verificationStatus: 'VERIFIED',
    } as never)
  })

  it('the quick-verify route delegates to moderateProfile with ORGANIZER_APPROVED', async () => {
    const result = await quickVerify('profile-1')

    expect(mockModerateProfile)
      .toHaveBeenCalledWith('profile-1', 'VERIFIED', undefined, 'ORGANIZER_APPROVED')
    expect(result).toEqual({
      id: 'profile-1',
      slug: 'john-doe',
      verificationStatus: 'VERIFIED',
    })
  })

  it('the moderation route asks for the same service call', async () => {
    await profileModeration('profile-1', { verificationStatus: 'VERIFIED' })

    expect(mockModerateProfile)
      .toHaveBeenCalledWith('profile-1', 'VERIFIED', undefined, 'ORGANIZER_APPROVED')
  })

  it('both routes produce byte-identical arguments for one profile', async () => {
    await quickVerify('profile-1')
    const fromQuickVerify = mockModerateProfile.mock.calls[0]

    await profileModeration('profile-1', { verificationStatus: 'VERIFIED' })
    const fromModerationDialog = mockModerateProfile.mock.calls[1]

    expect(fromQuickVerify).toEqual(fromModerationDialog)
  })

  it('routes a rejection through the same service with its reason', async () => {
    await profileModeration('profile-1', {
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

  it('rejects a malformed moderation body before touching the service', async () => {
    await expect(
      profileModeration('profile-1', { verificationStatus: 'MAYBE' }),
    ).rejects.toMatchObject({ statusCode: 400 })

    expect(mockModerateProfile).not.toHaveBeenCalled()
  })

  it('requires a profile id on the quick-verify route', async () => {
    await expect(quickVerify('')).rejects.toMatchObject({ statusCode: 400 })

    expect(mockModerateProfile).not.toHaveBeenCalled()
  })
})
