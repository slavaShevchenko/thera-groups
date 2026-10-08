import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('~~/server/utils/prisma', () => ({ prisma: globalThis.prisma }))

vi.mock('~~/server/utils/notifications', () => ({
  notifyAdminsGroupPendingReview: vi.fn(),
  notifyGroupPublished: vi.fn(),
  notifyGroupRejected: vi.fn(),
  notifyGroupSubmitted: vi.fn(),
  notifyGroupAutoReverted: vi.fn(),
}))

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- globalThis.prisma is set in test setup
const prisma = globalThis.prisma as any

// eslint-disable-next-line import/first -- import must follow vi.mock()
import { groupService } from '../../server/services/groupService'
// eslint-disable-next-line import/first -- import must follow vi.mock()
import { NotFoundError, ValidationError, ForbiddenError } from '../../server/utils/domainErrors'

function makeGroup(overrides: Record<string, unknown> = {}) {
  return {
    id: 'group-1',
    slug: 'test-group',
    title: 'Test Group',
    status: 'DRAFT',
    description: 'A test group',
    ...overrides,
  }
}

function makeOrganizerContext(overrides: Record<string, unknown> = {}) {
  return {
    userId: 'org-1',
    role: 'ORGANIZER',
    isAdmin: false,
    organizerId: 'profile-1',
    ...overrides,
  }
}

describe('groupService.updateGroup', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('authorization', () => {
    it('throws 404 when group does not exist', async () => {
      prisma.group.findFirst.mockResolvedValue(null)

      await expect(
        groupService.updateGroup('nonexistent', {}, makeOrganizerContext()),
      ).rejects.toBeInstanceOf(NotFoundError)
    })

    it('throws 403 when user is not owner, co-organizer or admin', async () => {
      prisma.group.findFirst.mockResolvedValue({
        ...makeGroup(),
        organizer: { id: 'profile-1', userId: 'org-1' },
        coOrganizers: [],
      })

      await expect(
        groupService.updateGroup('test-group', {}, makeOrganizerContext({ userId: 'org-other' })),
      ).rejects.toBeInstanceOf(ForbiddenError)
    })

    it('allows owner to update', async () => {
      prisma.group.findFirst.mockResolvedValue({
        ...makeGroup(),
        organizer: { id: 'profile-1', userId: 'org-1' },
        coOrganizers: [],
      })

      prisma.group.update.mockResolvedValue(makeGroup())

      const result = await groupService.updateGroup(
        'test-group',
        { title: 'Updated Title' },
        makeOrganizerContext({ userId: 'org-1' }),
      )

      expect(result.success).toBe(true)
    })

    it('allows admin to update any group', async () => {
      prisma.group.findFirst.mockResolvedValue({
        ...makeGroup(),
        organizer: { id: 'profile-other', userId: 'org-other' },
        coOrganizers: [],
      })

      prisma.group.update.mockResolvedValue(makeGroup())

      const result = await groupService.updateGroup(
        'test-group',
        { title: 'Admin Edit' },
        { userId: 'admin-1', role: 'ADMIN', isAdmin: true },
      )

      expect(result.success).toBe(true)
    })

    it('allows co-organizer to update common fields', async () => {
      prisma.group.findFirst.mockResolvedValue({
        ...makeGroup(),
        organizer: { id: 'profile-1', userId: 'org-1' },
        coOrganizers: [{ userId: 'org-2' }],
      })

      prisma.group.update.mockResolvedValue(makeGroup())

      const result = await groupService.updateGroup(
        'test-group',
        { title: 'Co-organizer Edit' },
        makeOrganizerContext({ userId: 'org-2' }),
      )

      expect(result.success).toBe(true)
    })

    it('strips status and coOrganizers from co-organizer updates', async () => {
      prisma.group.findFirst.mockResolvedValue({
        ...makeGroup(),
        organizer: { id: 'profile-1', userId: 'org-1' },
        coOrganizers: [{ userId: 'org-2' }],
      })

      prisma.group.update.mockResolvedValue(makeGroup())

      await groupService.updateGroup(
        'test-group',
        { title: 'Edit', status: 'PUBLISHED', coOrganizers: [{ userId: 'org-3' }] },
        makeOrganizerContext({ userId: 'org-2' }),
      )

      const updateCall = prisma.group.update.mock.calls[0][0]
      expect(updateCall.data.status).toBeUndefined()
      expect(updateCall.data.coOrganizers).toBeUndefined()
    })
  })

  describe('status transitions', () => {
    it('only admin can publish a group', async () => {
      prisma.group.findFirst.mockResolvedValue({
        ...makeGroup({ status: 'PENDING_REVIEW' }),
        organizer: { id: 'profile-1', userId: 'org-1' },
        coOrganizers: [],
      })

      await expect(
        groupService.updateGroup(
          'test-group',
          { status: 'PUBLISHED' },
          makeOrganizerContext({ userId: 'org-1' }),
        ),
      ).rejects.toBeInstanceOf(ForbiddenError)
    })

    it('admin can publish a group', async () => {
      prisma.group.findFirst.mockResolvedValue({
        ...makeGroup({ status: 'PENDING_REVIEW' }),
        organizer: { id: 'profile-1', userId: 'org-1' },
        coOrganizers: [],
      })

      prisma.group.update.mockResolvedValue(makeGroup({ status: 'PUBLISHED' }))

      const result = await groupService.updateGroup(
        'test-group',
        { status: 'PUBLISHED' },
        { userId: 'admin-1', role: 'ADMIN', isAdmin: true },
      )

      expect(result.success).toBe(true)
    })

    it('organizer can submit DRAFT for review', async () => {
      prisma.group.findFirst.mockResolvedValue({
        ...makeGroup({ status: 'DRAFT' }),
        organizer: { id: 'profile-1', userId: 'org-1' },
        coOrganizers: [],
      })

      prisma.group.update.mockResolvedValue(makeGroup({ status: 'PENDING_REVIEW' }))

      const result = await groupService.updateGroup(
        'test-group',
        { status: 'PENDING_REVIEW' },
        makeOrganizerContext({ userId: 'org-1' }),
      )

      expect(result.success).toBe(true)
    })

    it('organizer can submit REJECTED group for review again', async () => {
      prisma.group.findFirst.mockResolvedValue({
        ...makeGroup({ status: 'REJECTED' }),
        organizer: { id: 'profile-1', userId: 'org-1' },
        coOrganizers: [],
      })

      prisma.group.update.mockResolvedValue(makeGroup({ status: 'PENDING_REVIEW' }))

      const result = await groupService.updateGroup(
        'test-group',
        { status: 'PENDING_REVIEW' },
        makeOrganizerContext({ userId: 'org-1' }),
      )

      expect(result.success).toBe(true)
    })

    it('organizer can submit PUBLISHED group for review (auto-remoderation)', async () => {
      prisma.group.findFirst.mockResolvedValue({
        ...makeGroup({ status: 'PUBLISHED' }),
        organizer: { id: 'profile-1', userId: 'org-1' },
        coOrganizers: [],
      })

      prisma.group.update.mockResolvedValue(makeGroup({ status: 'PENDING_REVIEW' }))

      const result = await groupService.updateGroup(
        'test-group',
        { status: 'PENDING_REVIEW' },
        makeOrganizerContext({ userId: 'org-1' }),
      )

      expect(result.success).toBe(true)
    })

    it('organizer cannot change status of PUBLISHED group to DRAFT', async () => {
      prisma.group.findFirst.mockResolvedValue({
        ...makeGroup({ status: 'PUBLISHED' }),
        organizer: { id: 'profile-1', userId: 'org-1' },
        coOrganizers: [],
      })

      await expect(
        groupService.updateGroup(
          'test-group',
          { status: 'DRAFT' },
          makeOrganizerContext({ userId: 'org-1' }),
        ),
      ).rejects.toBeInstanceOf(ValidationError)
    })

    it('organizer cannot set PUBLISHED status even if group is already PUBLISHED', async () => {
      prisma.group.findFirst.mockResolvedValue({
        ...makeGroup({ status: 'PUBLISHED' }),
        organizer: { id: 'profile-1', userId: 'org-1' },
        coOrganizers: [],
      })

      await expect(
        groupService.updateGroup(
          'test-group',
          { status: 'PUBLISHED', title: 'Updated while published' },
          makeOrganizerContext({ userId: 'org-1' }),
        ),
      ).rejects.toBeInstanceOf(ValidationError)
    })
  })

  describe('tag validation', () => {
    it('throws when some tags do not exist', async () => {
      prisma.group.findFirst.mockResolvedValue({
        ...makeGroup(),
        organizer: { id: 'profile-1', userId: 'org-1' },
        coOrganizers: [],
      })

      prisma.groupTag.findMany.mockResolvedValue([{ id: 'tag-1' }])

      await expect(
        groupService.updateGroup(
          'test-group',
          { tagIds: ['tag-1', 'tag-nonexistent'] },
          makeOrganizerContext({ userId: 'org-1' }),
        ),
      ).rejects.toBeInstanceOf(ValidationError)
    })
  })

  describe('new optional fields', () => {
    beforeEach(() => {
      prisma.group.findFirst.mockResolvedValue({
        ...makeGroup(),
        organizer: { id: 'profile-1', userId: 'org-1' },
        coOrganizers: [],
      })
      prisma.group.update.mockResolvedValue(makeGroup())
    })

    it('writes minParticipants, durationHours, certificateIssued and program', async () => {
      await groupService.updateGroup(
        'test-group',
        {
          minParticipants: 4,
          durationHours: 12,
          certificateIssued: true,
          program: '1. Знайомство\n2. Вправи на заземлення',
        },
        makeOrganizerContext({ userId: 'org-1' }),
      )

      const { data } = prisma.group.update.mock.calls[0][0]
      expect(data.minParticipants).toBe(4)
      expect(data.durationHours).toBe(12)
      expect(data.certificateIssued).toBe(true)
      expect(data.program).toBe('1. Знайомство\n2. Вправи на заземлення')
    })

    it('stores certificateIssued false rather than coercing it to null', async () => {
      await groupService.updateGroup(
        'test-group',
        { certificateIssued: false },
        makeOrganizerContext({ userId: 'org-1' }),
      )

      expect(prisma.group.update.mock.calls[0][0].data.certificateIssued).toBe(false)
    })

    it('clears the new fields when they arrive null or empty', async () => {
      await groupService.updateGroup(
        'test-group',
        { minParticipants: null, durationHours: null, certificateIssued: null, program: '' },
        makeOrganizerContext({ userId: 'org-1' }),
      )

      const { data } = prisma.group.update.mock.calls[0][0]
      expect(data.minParticipants).toBeNull()
      expect(data.durationHours).toBeNull()
      expect(data.certificateIssued).toBeNull()
      expect(data.program).toBeNull()
    })

    it('leaves the new fields untouched when they are absent from the patch', async () => {
      await groupService.updateGroup(
        'test-group',
        { title: 'Only the title' },
        makeOrganizerContext({ userId: 'org-1' }),
      )

      const { data } = prisma.group.update.mock.calls[0][0]
      expect(data.minParticipants).toBeUndefined()
      expect(data.durationHours).toBeUndefined()
      expect(data.certificateIssued).toBeUndefined()
      expect(data.program).toBeUndefined()
    })

    it('writes endsAt when endDate arrives as an ISO string', async () => {
      await groupService.updateGroup(
        'test-group',
        { endDate: '2026-11-15T19:00:00.000Z' },
        makeOrganizerContext({ userId: 'org-1' }),
      )

      expect(prisma.group.update.mock.calls[0][0].data.endsAt)
        .toEqual(new Date('2026-11-15T19:00:00.000Z'))
    })

    it('clears endsAt when endDate arrives null', async () => {
      await groupService.updateGroup(
        'test-group',
        { endDate: null },
        makeOrganizerContext({ userId: 'org-1' }),
      )

      expect(prisma.group.update.mock.calls[0][0].data.endsAt).toBeNull()
    })

    it('leaves endsAt untouched when endDate is absent from the patch', async () => {
      await groupService.updateGroup(
        'test-group',
        { title: 'Only the title' },
        makeOrganizerContext({ userId: 'org-1' }),
      )

      expect(prisma.group.update.mock.calls[0][0].data.endsAt).toBeUndefined()
    })
  })

  describe('notifications', () => {
    it('notifies admins when group is submitted for review', async () => {
      const { notifyAdminsGroupPendingReview } = await import('~~/server/utils/notifications')

      prisma.group.findFirst.mockResolvedValue({
        ...makeGroup({ status: 'DRAFT', title: 'My Group', slug: 'my-group' }),
        organizer: { id: 'profile-1', userId: 'org-1' },
        coOrganizers: [],
      })

      prisma.group.update.mockResolvedValue(
        makeGroup({ status: 'PENDING_REVIEW', title: 'My Group', slug: 'my-group' }),
      )

      await groupService.updateGroup(
        'test-group',
        { status: 'PENDING_REVIEW' },
        makeOrganizerContext({ userId: 'org-1' }),
      )

      // No transaction argument: admins are notified after commit so the fire-and-forget
      // email cannot outlive a rolled-back update.
      expect(notifyAdminsGroupPendingReview).toHaveBeenCalledWith('My Group', 'my-group')
    })

    it('does not notify when status stayed PENDING_REVIEW', async () => {
      const { notifyAdminsGroupPendingReview, notifyGroupSubmitted, notifyGroupAutoReverted }
        = await import('~~/server/utils/notifications')

      prisma.group.findFirst.mockResolvedValue({
        ...makeGroup({ status: 'PENDING_REVIEW' }),
        organizer: { id: 'profile-1', userId: 'org-1' },
        coOrganizers: [],
      })

      prisma.group.update.mockResolvedValue(makeGroup({ status: 'PENDING_REVIEW' }))

      await groupService.updateGroup(
        'test-group',
        { title: 'Updated title' },
        makeOrganizerContext({ userId: 'org-1' }),
      )

      expect(notifyAdminsGroupPendingReview).not.toHaveBeenCalled()
      expect(notifyGroupSubmitted).not.toHaveBeenCalled()
      expect(notifyGroupAutoReverted).not.toHaveBeenCalled()
    })
  })

  describe('owner acknowledgement on the way into moderation', () => {
    // A published group as the edit form sees it: every critical field already stored, so
    // a payload that repeats them has changed nothing.
    function makePublishedGroup(overrides: Record<string, unknown> = {}) {
      return {
        ...makeGroup({
          status: 'PUBLISHED',
          title: 'My Group',
          slug: 'my-group',
          description: 'A test group',
        }),
        type: 'SUPPORT',
        format: 'ONLINE',
        location: 'Kyiv',
        priceAmount: { valueOf: () => 500 },
        currency: 'UAH',
        startsAt: new Date('2026-11-01T10:00:00.000Z'),
        endsAt: null,
        capacity: 12,
        organizer: { id: 'profile-1', userId: 'org-1' },
        coOrganizers: [],
        ...overrides,
      }
    }

    beforeEach(() => {
      prisma.group.update.mockResolvedValue(
        makeGroup({ status: 'PENDING_REVIEW', title: 'My Group', slug: 'my-group' }),
      )
    })

    it('acknowledges a deliberate submission and does not call it a revert', async () => {
      const { notifyGroupSubmitted, notifyGroupAutoReverted }
        = await import('~~/server/utils/notifications')

      prisma.group.findFirst.mockResolvedValue({
        ...makeGroup({ status: 'DRAFT', title: 'My Group', slug: 'my-group' }),
        organizer: { id: 'profile-1', userId: 'org-1' },
        coOrganizers: [],
      })

      await groupService.updateGroup(
        'my-group',
        { status: 'PENDING_REVIEW' },
        makeOrganizerContext({ userId: 'org-1' }),
      )

      expect(notifyGroupSubmitted).toHaveBeenCalledWith('org-1', 'My Group', 'my-group')
      expect(notifyGroupAutoReverted).not.toHaveBeenCalled()
    })

    it('names only the fields that really changed when a published group is auto-reverted', async () => {
      const { notifyGroupSubmitted, notifyGroupAutoReverted }
        = await import('~~/server/utils/notifications')

      prisma.group.findFirst.mockResolvedValue(makePublishedGroup())

      await groupService.updateGroup(
        'my-group',
        // The edit form resends the whole payload; only the title differs from the row.
        { title: 'Renamed group', description: 'A test group', format: 'ONLINE', location: 'Kyiv' },
        makeOrganizerContext({ userId: 'org-1' }),
      )

      expect(notifyGroupAutoReverted)
        .toHaveBeenCalledWith('org-1', 'My Group', 'my-group', ['title'])
      expect(notifyGroupSubmitted).not.toHaveBeenCalled()
    })

    it('compares decimals and dates by value, not by representation', async () => {
      const { notifyGroupAutoReverted } = await import('~~/server/utils/notifications')

      prisma.group.findFirst.mockResolvedValue(makePublishedGroup())

      await groupService.updateGroup(
        'my-group',
        { priceAmount: 500, startDate: '2026-11-01T10:00:00.000Z', maxParticipants: 12 },
        makeOrganizerContext({ userId: 'org-1' }),
      )

      // The revert still happens — a critical field was submitted — but there is nothing
      // to name, so the email omits the list instead of inventing one.
      expect(notifyGroupAutoReverted).toHaveBeenCalledWith('org-1', 'My Group', 'my-group', [])
    })

    it('reports a changed price, date and capacity', async () => {
      const { notifyGroupAutoReverted } = await import('~~/server/utils/notifications')

      prisma.group.findFirst.mockResolvedValue(makePublishedGroup())

      await groupService.updateGroup(
        'my-group',
        {
          priceAmount: 600,
          startDate: '2026-12-01T10:00:00.000Z',
          endDate: '2026-12-02T10:00:00.000Z',
          maxParticipants: 20,
        },
        makeOrganizerContext({ userId: 'org-1' }),
      )

      expect(notifyGroupAutoReverted).toHaveBeenCalledWith(
        'org-1',
        'My Group',
        'my-group',
        ['priceAmount', 'startDate', 'endDate', 'maxParticipants'],
      )
    })

    it('notifies admins and the owner for the same auto-revert', async () => {
      const { notifyAdminsGroupPendingReview, notifyGroupAutoReverted }
        = await import('~~/server/utils/notifications')

      prisma.group.findFirst.mockResolvedValue(makePublishedGroup())

      await groupService.updateGroup(
        'my-group',
        { title: 'Renamed group' },
        makeOrganizerContext({ userId: 'org-1' }),
      )

      expect(notifyAdminsGroupPendingReview).toHaveBeenCalledWith('My Group', 'my-group')
      expect(notifyGroupAutoReverted).toHaveBeenCalledOnce()
    })
  })
})

describe('groupService.moderateGroup', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('approval', () => {
    it('approves a PENDING_REVIEW group', async () => {
      prisma.group.findUnique
        .mockResolvedValueOnce({
          id: 'group-1',
          status: 'PENDING_REVIEW',
          title: 'Test',
          slug: 'test',
        })

      prisma.group.update.mockResolvedValue({
        id: 'group-1',
        status: 'PUBLISHED',
        title: 'Test',
        slug: 'test',
        rejectionReason: null,
        organizer: {
          userId: 'org-1',
          user: { preferredLocale: 'ua' },
        },
      })

      const result = await groupService.moderateGroup('group-1', 'PUBLISHED')

      expect(result.group.status).toBe('PUBLISHED')
    })

    it('rejects approval when group is not PENDING_REVIEW', async () => {
      prisma.group.findUnique.mockResolvedValue({
        id: 'group-1',
        status: 'DRAFT',
        title: 'Test',
        slug: 'test',
      })

      await expect(
        groupService.moderateGroup('group-1', 'PUBLISHED'),
      ).rejects.toBeInstanceOf(ValidationError)
    })
  })

  describe('rejection', () => {
    it('rejects a PENDING_REVIEW group with reason', async () => {
      prisma.group.findUnique
        .mockResolvedValueOnce({
          id: 'group-1',
          status: 'PENDING_REVIEW',
          title: 'Test',
          slug: 'test',
        })

      prisma.group.update.mockResolvedValue({
        id: 'group-1',
        status: 'REJECTED',
        title: 'Test',
        slug: 'test',
        rejectionReason: 'Incomplete info',
        organizer: {
          userId: 'org-1',
          user: { preferredLocale: 'ua' },
        },
      })

      const result = await groupService.moderateGroup('group-1', 'REJECTED', 'Incomplete info')

      expect(result.group.status).toBe('REJECTED')
      expect(result.group.rejectionReason).toBe('Incomplete info')
    })

    it('rejects a PUBLISHED group (takedown)', async () => {
      prisma.group.findUnique
        .mockResolvedValueOnce({
          id: 'group-1',
          status: 'PUBLISHED',
          title: 'Test',
          slug: 'test',
        })

      prisma.group.update.mockResolvedValue({
        id: 'group-1',
        status: 'REJECTED',
        title: 'Test',
        slug: 'test',
        rejectionReason: 'Policy violation',
        organizer: {
          userId: 'org-1',
          user: { preferredLocale: 'ua' },
        },
      })

      const result = await groupService.moderateGroup('group-1', 'REJECTED', 'Policy violation')

      expect(result.group.status).toBe('REJECTED')
    })

    it('rejects when status is not PENDING_REVIEW or PUBLISHED', async () => {
      prisma.group.findUnique.mockResolvedValue({
        id: 'group-1',
        status: 'DRAFT',
        title: 'Test',
        slug: 'test',
      })

      await expect(
        groupService.moderateGroup('group-1', 'REJECTED', 'Some reason'),
      ).rejects.toBeInstanceOf(ValidationError)
    })

    it('requires rejection reason', async () => {
      prisma.group.findUnique.mockResolvedValue({
        id: 'group-1',
        status: 'PENDING_REVIEW',
        title: 'Test',
        slug: 'test',
      })

      await expect(
        groupService.moderateGroup('group-1', 'REJECTED'),
      ).rejects.toBeInstanceOf(ValidationError)
    })

    it('rejects empty string as rejection reason', async () => {
      prisma.group.findUnique.mockResolvedValue({
        id: 'group-1',
        status: 'PENDING_REVIEW',
        title: 'Test',
        slug: 'test',
      })

      await expect(
        groupService.moderateGroup('group-1', 'REJECTED', '   '),
      ).rejects.toBeInstanceOf(ValidationError)
    })
  })

  describe('not found', () => {
    it('throws 404 when group does not exist', async () => {
      prisma.group.findUnique.mockResolvedValue(null)

      await expect(
        groupService.moderateGroup('nonexistent', 'PUBLISHED'),
      ).rejects.toBeInstanceOf(NotFoundError)
    })
  })

  describe('notifications on moderate', () => {
    it('sends published notification on approval', async () => {
      const { notifyGroupPublished } = await import('~~/server/utils/notifications')

      prisma.group.findUnique
        .mockResolvedValueOnce({
          id: 'group-1',
          status: 'PENDING_REVIEW',
          title: 'Test Group',
          slug: 'test-group',
        })

      prisma.group.update.mockResolvedValue({
        id: 'group-1',
        status: 'PUBLISHED',
        title: 'Test Group',
        slug: 'test-group',
        rejectionReason: null,
        organizer: {
          userId: 'org-1',
          user: { preferredLocale: 'en' },
        },
      })

      await groupService.moderateGroup('group-1', 'PUBLISHED')

      expect(notifyGroupPublished).toHaveBeenCalledWith('org-1', 'Test Group', 'test-group', 'en')
    })

    it('sends rejected notification on rejection', async () => {
      const { notifyGroupRejected } = await import('~~/server/utils/notifications')

      prisma.group.findUnique
        .mockResolvedValueOnce({
          id: 'group-1',
          status: 'PENDING_REVIEW',
          title: 'Test Group',
          slug: 'test-group',
        })

      prisma.group.update.mockResolvedValue({
        id: 'group-1',
        status: 'REJECTED',
        title: 'Test Group',
        slug: 'test-group',
        rejectionReason: 'Bad content',
        organizer: {
          userId: 'org-1',
          user: { preferredLocale: 'ua' },
        },
      })

      await groupService.moderateGroup('group-1', 'REJECTED', 'Bad content')

      expect(notifyGroupRejected).toHaveBeenCalledWith('org-1', 'Test Group', 'test-group', 'Bad content', 'ua')
    })
  })
})
