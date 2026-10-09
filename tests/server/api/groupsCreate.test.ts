import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createEvent } from 'h3'

vi.mock('~~/server/utils/auth', () => ({
  requireAuth: vi.fn(),
}))

vi.mock('~~/server/services/groupService', () => ({
  groupService: {
    create: vi.fn(),
  },
}))

vi.mock('~~/server/repositories/groupRepository', () => ({
  groupRepository: {
    slugExists: vi.fn(),
  },
}))

vi.mock('~~/server/repositories/organizerRepository', () => ({
  organizerRepository: {
    findById: vi.fn(),
    findByUserId: vi.fn(),
    // Must never be consulted by POST /api/groups again: it is what let an admin-created
    // group land on a stranger's profile.
    findPendingVerification: vi.fn(),
  },
}))

vi.mock('~~/server/utils/prisma', () => ({ prisma: globalThis.prisma }))

// eslint-disable-next-line import/first -- import must follow vi.mock()
import { requireAuth } from '~~/server/utils/auth'
// eslint-disable-next-line import/first -- import must follow vi.mock()
import { groupService } from '~~/server/services/groupService'
// eslint-disable-next-line import/first -- import must follow vi.mock()
import { groupRepository } from '~~/server/repositories/groupRepository'
// eslint-disable-next-line import/first -- import must follow vi.mock()
import { organizerRepository } from '~~/server/repositories/organizerRepository'

const mockRequireAuth = vi.mocked(requireAuth)
const mockCreate = vi.mocked(groupService.create)
const mockSlugExists = vi.mocked(groupRepository.slugExists)
const mockFindById = vi.mocked(organizerRepository.findById)
const mockFindByUserId = vi.mocked(organizerRepository.findByUserId)
const mockFindPendingVerification = vi.mocked(organizerRepository.findPendingVerification)

const ADMIN = { id: 'admin-1', role: 'ADMIN', isActive: true }
const ORGANIZER = { id: 'org-user-1', role: 'ORGANIZER', isActive: true }

const OWN_PROFILE = { id: 'profile-own', userId: 'org-user-1', verificationStatus: 'VERIFIED' }
const OTHER_PROFILE = { id: 'profile-other', userId: 'org-user-2', verificationStatus: 'VERIFIED' }

function makePostEvent(body?: unknown) {
  // `headers` must exist even when empty: h3's readBody reads `content-type` off it.
  const event = createEvent({
    url: '/api/groups',
    method: 'POST',
    headers: body === undefined ? {} : { 'content-type': 'application/json' },
  }, {})
  if (body !== undefined) event._requestBody = JSON.stringify(body)
  return event
}

async function postGroup(body?: unknown) {
  const mod = await import('../../../server/api/groups.post')
  const handler = mod.default as unknown as (_event: unknown) => Promise<unknown>
  return handler(makePostEvent(body))
}

describe('POST /api/groups', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    mockSlugExists.mockResolvedValue(false)
    mockCreate.mockResolvedValue({
      id: 'group-1',
      slug: 'new-group',
      title: '',
      status: 'DRAFT',
    } as never)
  })

  describe('as ADMIN', () => {
    beforeEach(() => {
      mockRequireAuth.mockResolvedValue(ADMIN as never)
    })

    it('refuses to create without an explicit organizerId', async () => {
      await expect(postGroup({})).rejects.toMatchObject({
        statusCode: 400,
        data: { code: 'VALIDATION_FAILED', field: 'organizerId' },
      })

      expect(mockCreate).not.toHaveBeenCalled()
    })

    it('refuses an empty body the same way, and never reaches for the pending queue', async () => {
      await expect(postGroup()).rejects.toMatchObject({ statusCode: 400 })

      expect(mockFindPendingVerification).not.toHaveBeenCalled()
      expect(mockCreate).not.toHaveBeenCalled()
    })

    it('returns 404 for an organizerId that does not exist', async () => {
      mockFindById.mockResolvedValue(null)

      await expect(postGroup({ organizerId: 'missing' })).rejects.toMatchObject({
        statusCode: 404,
        data: { code: 'NOT_FOUND' },
      })

      expect(mockCreate).not.toHaveBeenCalled()
    })

    it('returns 400 for an organizer profile that is not VERIFIED', async () => {
      mockFindById.mockResolvedValue({ ...OTHER_PROFILE, verificationStatus: 'PENDING' } as never)

      await expect(postGroup({ organizerId: OTHER_PROFILE.id })).rejects.toMatchObject({
        statusCode: 400,
        data: { code: 'VALIDATION_FAILED', field: 'organizerId' },
      })

      expect(mockCreate).not.toHaveBeenCalled()
    })

    it('creates the draft on the chosen VERIFIED profile', async () => {
      mockFindById.mockResolvedValue(OTHER_PROFILE as never)

      const result = await postGroup({ organizerId: OTHER_PROFILE.id }) as { group: { slug: string } }

      expect(mockCreate).toHaveBeenCalledWith({
        organizerId: OTHER_PROFILE.id,
        slug: 'new-group',
      })
      expect(result.group.slug).toBe('new-group')
    })
  })

  describe('as ORGANIZER', () => {
    beforeEach(() => {
      mockRequireAuth.mockResolvedValue(ORGANIZER as never)
    })

    it('ignores a supplied organizerId and creates on the caller own profile', async () => {
      mockFindByUserId.mockResolvedValue(OWN_PROFILE as never)

      await postGroup({ organizerId: OTHER_PROFILE.id })

      expect(mockFindById).not.toHaveBeenCalled()
      expect(mockCreate).toHaveBeenCalledWith({
        organizerId: OWN_PROFILE.id,
        slug: 'new-group',
      })
    })

    it('creates from an empty body, which is what the new-group page sends', async () => {
      mockFindByUserId.mockResolvedValue(OWN_PROFILE as never)

      await expect(postGroup()).resolves.toMatchObject({ success: true })

      expect(mockCreate).toHaveBeenCalledWith({
        organizerId: OWN_PROFILE.id,
        slug: 'new-group',
      })
    })

    it('returns 403 when the caller has no organizer profile', async () => {
      mockFindByUserId.mockResolvedValue(null)

      await expect(postGroup()).rejects.toMatchObject({
        statusCode: 403,
        data: { code: 'FORBIDDEN' },
      })
    })

    it('returns 403 when the caller profile is still PENDING', async () => {
      mockFindByUserId.mockResolvedValue({ ...OWN_PROFILE, verificationStatus: 'PENDING' } as never)

      await expect(postGroup()).rejects.toMatchObject({ statusCode: 403 })

      expect(mockCreate).not.toHaveBeenCalled()
    })
  })

  it('rejects a malformed body before touching the database', async () => {
    mockRequireAuth.mockResolvedValue(ADMIN as never)

    await expect(postGroup({ organizerId: 42 })).rejects.toMatchObject({
      statusCode: 400,
      data: { code: 'VALIDATION_FAILED' },
    })

    expect(mockFindById).not.toHaveBeenCalled()
    expect(mockCreate).not.toHaveBeenCalled()
  })
})
