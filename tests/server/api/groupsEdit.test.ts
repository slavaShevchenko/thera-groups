import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createEvent } from 'h3'

vi.mock('~~/server/utils/auth', () => ({
  requireAuth: vi.fn(),
}))

vi.mock('~~/server/repositories/groupRepository', () => ({
  groupRepository: {
    findBySlugForEdit: vi.fn(),
  },
}))

vi.mock('~~/server/utils/prisma', () => ({ prisma: globalThis.prisma }))

// eslint-disable-next-line import/first -- import must follow vi.mock()
import { requireAuth } from '~~/server/utils/auth'
// eslint-disable-next-line import/first -- import must follow vi.mock()
import { groupRepository } from '~~/server/repositories/groupRepository'

const mockRequireAuth = vi.mocked(requireAuth)
const mockFindBySlugForEdit = vi.mocked(groupRepository.findBySlugForEdit)

function makeGetEvent(url: string) {
  const event = createEvent({ url, method: 'GET' }, {})
  event.context.params = { ...event.context.params, slug: 'test-group' }
  return event
}

type Event = ReturnType<typeof makeGetEvent>
type User = Awaited<ReturnType<typeof requireAuth>>

/**
 * Shaped like `findBySlugForEdit`'s row: the handler reads every one of these, so a missing
 * field shows up as a TypeError rather than as a clean failure.
 */
function makeEditRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'group-1',
    slug: 'test-group',
    title: 'Test group',
    description: 'Body',
    program: null,
    status: 'DRAFT',
    format: 'ONLINE',
    type: 'SUPPORT',
    location: null,
    languages: ['uk'],
    startsAt: new Date('2026-11-01T10:00:00.000Z'),
    endsAt: new Date('2026-11-01T12:00:00.000Z'),
    timezone: 'Europe/Kyiv',
    capacity: 12,
    minParticipants: null,
    durationHours: null,
    certificateIssued: false,
    priceAmount: null,
    currency: 'UAH',
    rejectionReason: null,
    createdAt: new Date('2026-10-01T10:00:00.000Z'),
    organizer: {
      userId: 'owner-1',
      firstName: 'Олена',
      lastName: 'Коваль',
      slug: 'olena-koval',
    },
    tags: [],
    questions: [],
    coOrganizers: [],
    _count: { applications: 0 },
    ...overrides,
  }
}

describe('GET /api/groups/[slug]/edit', () => {
  let handler: (_event: Event) => Promise<Record<string, unknown>>

  beforeEach(async () => {
    vi.clearAllMocks()

    const mod = await import('../../../server/api/groups/[slug]/edit.get')
    handler = mod.default as unknown as (_event: Event) => Promise<Record<string, unknown>>
  })

  it('returns the owner id together with a display name', async () => {
    mockRequireAuth.mockResolvedValue({ id: 'admin-1', role: 'ADMIN' } as User)
    mockFindBySlugForEdit.mockResolvedValue(makeEditRow() as never)

    const response = await handler(makeGetEvent('/api/groups/test-group/edit'))

    // An admin chooses the owner once, on /groups/new. The edit page reads it back from here
    // to show who the group belongs to and to enable publishing, so both halves of the pair
    // have to travel — the id alone leaves the admin looking at an unnamed selection.
    expect(response.organizerUserId).toBe('owner-1')
    expect(response.organizerName).toBe('Олена Коваль')
  })

  it('trims the joined name when a profile has no last name', async () => {
    mockRequireAuth.mockResolvedValue({ id: 'admin-1', role: 'ADMIN' } as User)
    mockFindBySlugForEdit.mockResolvedValue(makeEditRow({
      organizer: { userId: 'owner-1', firstName: 'Олена', lastName: '', slug: 'olena' },
    }) as never)

    const response = await handler(makeGetEvent('/api/groups/test-group/edit'))

    expect(response.organizerName).toBe('Олена')
  })

  it('answers 404 for a caller who is neither owner, co-organizer nor admin', async () => {
    mockRequireAuth.mockResolvedValue({ id: 'stranger-1', role: 'ORGANIZER' } as User)
    mockFindBySlugForEdit.mockResolvedValue(makeEditRow() as never)

    // 404 rather than 403, so the endpoint cannot be used to discover which slugs exist.
    await expect(handler(makeGetEvent('/api/groups/test-group/edit')))
      .rejects
      .toMatchObject({ statusCode: 404 })
  })

  it('answers 404 when the group has no organizer row left', async () => {
    mockRequireAuth.mockResolvedValue({ id: 'admin-1', role: 'ADMIN' } as User)
    // `Group.organizerId` is nullable with onDelete: SetNull, so a deleted profile leaves the
    // group ownerless — the handler must not reach for `.firstName` on null.
    mockFindBySlugForEdit.mockResolvedValue(makeEditRow({ organizer: null }) as never)

    await expect(handler(makeGetEvent('/api/groups/test-group/edit')))
      .rejects
      .toMatchObject({ statusCode: 404 })
  })
})
