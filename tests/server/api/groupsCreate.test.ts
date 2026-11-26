import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createEvent } from 'h3'
import { GROUP_LIMITS } from '~~/shared/constants/limits'

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

const TITLE = 'Група підтримки для батьків'
/** `slugify(TITLE)` — the base the handler cuts the slug from. */
const SLUG_BASE = 'hrupa-pidtrymky-dlya-batkiv'
/**
 * The suffix is always appended, so the only shape a group slug may take is base-plus-6-hex.
 * Asserting the shape rather than a value is the point: the handler must never fall back to
 * the bare base, which is how the first published event ended up at `/ua/groups/new-group`.
 */
const SLUG_SHAPE = new RegExp(`^${SLUG_BASE}-[0-9a-f]{6}$`)

/** Every create carries a title now; only the title-validation tests build a body without one. */
function titled(extra: Record<string, unknown> = {}) {
  return { title: TITLE, ...extra }
}

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
    mockCreate.mockImplementation((async (data: { slug: string, title: string }) => ({
      id: 'group-1',
      slug: data.slug,
      title: data.title,
      status: 'DRAFT',
    })) as never)
  })

  describe('as ADMIN', () => {
    beforeEach(() => {
      mockRequireAuth.mockResolvedValue(ADMIN as never)
    })

    it('refuses to create without an explicit organizerId', async () => {
      await expect(postGroup(titled())).rejects.toMatchObject({
        statusCode: 400,
        data: { code: 'VALIDATION_FAILED', field: 'organizerId' },
      })

      expect(mockCreate).not.toHaveBeenCalled()
    })

    it('refuses an organizerId-less body the same way, and never reaches for the pending queue', async () => {
      await expect(postGroup(titled())).rejects.toMatchObject({ statusCode: 400 })

      expect(mockFindPendingVerification).not.toHaveBeenCalled()
      expect(mockCreate).not.toHaveBeenCalled()
    })

    it('returns 404 for an organizerId that does not exist', async () => {
      mockFindById.mockResolvedValue(null)

      await expect(postGroup(titled({ organizerId: 'missing' }))).rejects.toMatchObject({
        statusCode: 404,
        data: { code: 'NOT_FOUND' },
      })

      expect(mockCreate).not.toHaveBeenCalled()
    })

    it('returns 400 for an organizer profile that is not VERIFIED', async () => {
      mockFindById.mockResolvedValue({ ...OTHER_PROFILE, verificationStatus: 'PENDING' } as never)

      await expect(postGroup(titled({ organizerId: OTHER_PROFILE.id }))).rejects.toMatchObject({
        statusCode: 400,
        data: { code: 'VALIDATION_FAILED', field: 'organizerId' },
      })

      expect(mockCreate).not.toHaveBeenCalled()
    })

    it('creates the draft on the chosen VERIFIED profile', async () => {
      mockFindById.mockResolvedValue(OTHER_PROFILE as never)

      const result = await postGroup(titled({ organizerId: OTHER_PROFILE.id })) as {
        success: boolean
        group: { slug: string, title: string }
      }

      expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({
        organizerId: OTHER_PROFILE.id,
        title: TITLE,
        slug: expect.stringMatching(SLUG_SHAPE),
      }))
      expect(result.success).toBe(true)
      expect(result.group.slug).toMatch(SLUG_SHAPE)
      expect(result.group.title).toBe(TITLE)
    })
  })

  describe('as ORGANIZER', () => {
    beforeEach(() => {
      mockRequireAuth.mockResolvedValue(ORGANIZER as never)
    })

    it('ignores a supplied organizerId and creates on the caller own profile', async () => {
      mockFindByUserId.mockResolvedValue(OWN_PROFILE as never)

      await postGroup(titled({ organizerId: OTHER_PROFILE.id }))

      expect(mockFindById).not.toHaveBeenCalled()
      expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({
        organizerId: OWN_PROFILE.id,
        title: TITLE,
        slug: expect.stringMatching(SLUG_SHAPE),
      }))
    })

    it('creates from a title-only body, which is what the new-group page sends', async () => {
      mockFindByUserId.mockResolvedValue(OWN_PROFILE as never)

      await expect(postGroup(titled())).resolves.toMatchObject({ success: true })

      expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({
        organizerId: OWN_PROFILE.id,
        title: TITLE,
      }))
    })

    it('returns 403 when the caller has no organizer profile', async () => {
      mockFindByUserId.mockResolvedValue(null)

      await expect(postGroup(titled())).rejects.toMatchObject({
        statusCode: 403,
        data: { code: 'FORBIDDEN' },
      })
    })

    it('returns 403 when the caller profile is still PENDING', async () => {
      mockFindByUserId.mockResolvedValue({ ...OWN_PROFILE, verificationStatus: 'PENDING' } as never)

      await expect(postGroup(titled())).rejects.toMatchObject({ statusCode: 403 })

      expect(mockCreate).not.toHaveBeenCalled()
    })
  })

  describe('title', () => {
    beforeEach(() => {
      mockRequireAuth.mockResolvedValue(ORGANIZER as never)
      mockFindByUserId.mockResolvedValue(OWN_PROFILE as never)
    })

    it('rejects a body with no title, which is what creation used to accept', async () => {
      await expect(postGroup({})).rejects.toMatchObject({
        statusCode: 400,
        data: { code: 'VALIDATION_FAILED' },
      })

      expect(mockCreate).not.toHaveBeenCalled()
    })

    it('rejects an absent body outright', async () => {
      await expect(postGroup()).rejects.toMatchObject({ statusCode: 400 })

      expect(mockCreate).not.toHaveBeenCalled()
    })

    it('rejects a whitespace-only title, so the slug cannot be cut from nothing', async () => {
      await expect(postGroup({ title: '    ' })).rejects.toMatchObject({
        statusCode: 400,
        data: { code: 'VALIDATION_FAILED' },
      })

      expect(mockCreate).not.toHaveBeenCalled()
    })

    it(`rejects a title shorter than ${GROUP_LIMITS.TITLE_MIN} characters`, async () => {
      await expect(postGroup({ title: 'a'.repeat(GROUP_LIMITS.TITLE_MIN - 1) })).rejects.toMatchObject({
        statusCode: 400,
        data: { code: 'VALIDATION_FAILED' },
      })

      expect(mockCreate).not.toHaveBeenCalled()
    })

    it(`rejects a title longer than ${GROUP_LIMITS.TITLE_MAX} characters`, async () => {
      await expect(postGroup({ title: 'a'.repeat(GROUP_LIMITS.TITLE_MAX + 1) })).rejects.toMatchObject({
        statusCode: 400,
        data: { code: 'VALIDATION_FAILED' },
      })

      expect(mockCreate).not.toHaveBeenCalled()
    })

    it('trims the title it stores and slugs', async () => {
      await postGroup({ title: `  ${TITLE}  ` })

      expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({
        title: TITLE,
        slug: expect.stringMatching(SLUG_SHAPE),
      }))
    })

    it('caps the slug at GROUP_LIMITS.SLUG_MAX even for a maximal title', async () => {
      const longTitle = 'група '.repeat(Math.ceil(GROUP_LIMITS.TITLE_MAX / 6)).slice(0, GROUP_LIMITS.TITLE_MAX)

      await postGroup({ title: longTitle })

      const slug = mockCreate.mock.calls[0]?.[0]?.slug as string
      expect(slug.length).toBeLessThanOrEqual(GROUP_LIMITS.SLUG_MAX)
      expect(slug).toMatch(/-[0-9a-f]{6}$/)
      // Cut on a word boundary, not mid-syllable: the character before the suffix is a word's
      // last letter, never a hyphen.
      expect(slug.slice(0, slug.length - 7)).not.toMatch(/-$/)
    })
  })

  it('rejects a malformed body before touching the database', async () => {
    mockRequireAuth.mockResolvedValue(ADMIN as never)

    await expect(postGroup(titled({ organizerId: 42 }))).rejects.toMatchObject({
      statusCode: 400,
      data: { code: 'VALIDATION_FAILED' },
    })

    expect(mockFindById).not.toHaveBeenCalled()
    expect(mockCreate).not.toHaveBeenCalled()
  })
})
