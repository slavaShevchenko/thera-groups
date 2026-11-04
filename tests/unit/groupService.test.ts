import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('~~/server/utils/prisma', () => ({ prisma: globalThis.prisma }))

vi.mock('~~/server/utils/notifications', () => ({
  notifyAdminsGroupPendingReview: vi.fn(),
  notifyGroupPublished: vi.fn(),
  notifyGroupRejected: vi.fn(),
  notifyGroupSubmitted: vi.fn(),
  notifyGroupAutoReverted: vi.fn(),
  notifyGroupCompleted: vi.fn(),
  notifyGroupCancelled: vi.fn(),
}))

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- globalThis.prisma is set in test setup
const prisma = globalThis.prisma as any

// eslint-disable-next-line import/first -- import must follow vi.mock()
import { groupService } from '../../server/services/groupService'
// eslint-disable-next-line import/first -- import must follow vi.mock()
import { NotFoundError, ValidationError, ForbiddenError, HasApplicationsError } from '../../server/utils/domainErrors'
// eslint-disable-next-line import/first -- import must follow vi.mock()
import { notifyGroupCancelled, notifyGroupCompleted } from '../../server/utils/notifications'
// eslint-disable-next-line import/first -- import must follow vi.mock()
import type { UpdateGroupInput } from '../../server/validators/group'

const mockNotifyGroupCompleted = vi.mocked(notifyGroupCompleted)
const mockNotifyGroupCancelled = vi.mocked(notifyGroupCancelled)

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

// A published group as the edit form sees it: every critical field already stored, so a
// payload that repeats them has changed nothing.
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

    // `Group.organizerId` is nullable with an `ON DELETE SET NULL` foreign key, so a row can
    // outlive its organizer. It is indistinguishable from a slug that never existed: nobody
    // owns it, so nobody but an admin may act on it, and there is no owner to name.
    it('throws 404 when the group exists but its organizer is gone', async () => {
      prisma.group.findFirst.mockResolvedValue({
        ...makeGroup(),
        organizer: null,
        coOrganizers: [],
      })

      await expect(
        groupService.updateGroup('test-group', {}, makeOrganizerContext()),
      ).rejects.toBeInstanceOf(NotFoundError)
    })

    it('throws 404 rather than crashing when an admin edits the co-organizers of an orphan', async () => {
      // This is the path that used to read `existing.organizer!.userId`, to work out which
      // co-organizer is really the owner and must not be seated twice. The guard above is
      // what makes that read safe; without it an orphan group turned a 404 into a TypeError.
      prisma.group.findFirst.mockResolvedValue({
        ...makeGroup(),
        organizer: null,
        coOrganizers: [],
      })

      await expect(
        groupService.updateGroup(
          'test-group',
          { coOrganizers: [{ userId: 'org-2', role: 'CO_ORGANIZER' }] },
          { userId: 'admin-1', role: 'ADMIN', isAdmin: true },
        ),
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

  // COMPLETED and CANCELLED were declared in the transition map but unreachable: the PATCH
  // validator did not accept them, so past events stayed PUBLISHED forever and kept taking
  // applications, and a cancelled group could never come back.
  describe('ending a group', () => {
    function mockExisting(status: string, overrides: Record<string, unknown> = {}) {
      prisma.group.findFirst.mockResolvedValue({
        ...makeGroup({ status }),
        rejectionReason: null,
        organizer: { id: 'profile-1', userId: 'org-1' },
        coOrganizers: [],
        ...overrides,
      })
    }

    it.each(['PUBLISHED', 'FULL'])('owner can mark a %s group completed', async (status) => {
      mockExisting(status)
      prisma.group.update.mockResolvedValue(makeGroup({ status: 'COMPLETED' }))

      const result = await groupService.updateGroup(
        'test-group',
        { status: 'COMPLETED' },
        makeOrganizerContext({ userId: 'org-1' }),
      )

      expect(result.success).toBe(true)
      expect(prisma.group.update.mock.calls[0][0].data.status).toBe('COMPLETED')
    })

    it.each(['PUBLISHED', 'FULL'])('owner can cancel a %s group', async (status) => {
      mockExisting(status)
      prisma.group.update.mockResolvedValue(makeGroup({ status: 'CANCELLED' }))

      await groupService.updateGroup(
        'test-group',
        { status: 'CANCELLED' },
        makeOrganizerContext({ userId: 'org-1' }),
      )

      expect(prisma.group.update.mock.calls[0][0].data.status).toBe('CANCELLED')
    })

    it('lets an admin end a group they do not own', async () => {
      mockExisting('PUBLISHED')
      prisma.group.update.mockResolvedValue(makeGroup({ status: 'CANCELLED' }))

      await groupService.updateGroup(
        'test-group',
        { status: 'CANCELLED' },
        { userId: 'admin-1', role: 'ADMIN', isAdmin: true },
      )

      expect(prisma.group.update.mock.calls[0][0].data.status).toBe('CANCELLED')
    })

    it('drops a co-organizer status change instead of letting them end the group', async () => {
      mockExisting('PUBLISHED', { coOrganizers: [{ userId: 'org-2' }] })
      prisma.group.update.mockResolvedValue(makeGroup({ status: 'PUBLISHED' }))

      await groupService.updateGroup(
        'test-group',
        { status: 'CANCELLED' },
        makeOrganizerContext({ userId: 'org-2' }),
      )

      // Ending a group emails every approved applicant, so a co-organizer's request is
      // dropped rather than honoured — and nobody is told the event is over.
      expect(prisma.group.update.mock.calls[0][0].data.status).toBeUndefined()
      expect(mockNotifyGroupCancelled).not.toHaveBeenCalled()
      expect(mockNotifyGroupCompleted).not.toHaveBeenCalled()
    })

    it('treats COMPLETED as terminal', async () => {
      mockExisting('COMPLETED')

      await expect(
        groupService.updateGroup(
          'test-group',
          { status: 'CANCELLED' },
          makeOrganizerContext({ userId: 'org-1' }),
        ),
      ).rejects.toBeInstanceOf(ValidationError)
    })

    it('lets an admin send a cancelled group back through moderation', async () => {
      mockExisting('CANCELLED')
      prisma.group.update.mockResolvedValue(makeGroup({ status: 'PENDING_REVIEW' }))

      await groupService.updateGroup(
        'test-group',
        { status: 'PENDING_REVIEW' },
        { userId: 'admin-1', role: 'ADMIN', isAdmin: true },
      )

      expect(prisma.group.update.mock.calls[0][0].data.status).toBe('PENDING_REVIEW')
    })

    it('refuses to republish a cancelled group directly', async () => {
      mockExisting('CANCELLED')

      await expect(
        groupService.updateGroup(
          'test-group',
          { status: 'PUBLISHED' },
          { userId: 'admin-1', role: 'ADMIN', isAdmin: true },
        ),
      ).rejects.toBeInstanceOf(ValidationError)
    })

    // Reversal is deliberately an admin action: the organizer cannot undo a cancellation
    // themselves, they have to be let back in through moderation.
    it('refuses the owner, who can only get a cancelled group back through an admin', async () => {
      mockExisting('CANCELLED')

      await expect(
        groupService.updateGroup(
          'test-group',
          { status: 'PENDING_REVIEW' },
          makeOrganizerContext({ userId: 'org-1' }),
        ),
      ).rejects.toBeInstanceOf(ValidationError)
      expect(prisma.group.update).not.toHaveBeenCalled()
    })

    it('cannot end a draft that was never public', async () => {
      mockExisting('DRAFT')

      await expect(
        groupService.updateGroup(
          'test-group',
          { status: 'CANCELLED' },
          makeOrganizerContext({ userId: 'org-1' }),
        ),
      ).rejects.toBeInstanceOf(ValidationError)
    })

    it('notifies owner and applicants after a cancellation, and only after the commit', async () => {
      mockExisting('PUBLISHED')
      prisma.group.update.mockResolvedValue(makeGroup({ status: 'CANCELLED', title: 'Renamed' }))

      await groupService.updateGroup(
        'test-group',
        { status: 'CANCELLED' },
        makeOrganizerContext({ userId: 'org-1' }),
      )

      // A rolled-back transaction must not have told anybody their event was cancelled, so
      // the fan-out runs after `$transaction` resolves and reads the committed title.
      expect(mockNotifyGroupCancelled).toHaveBeenCalledWith({
        id: 'group-1',
        title: 'Renamed',
        slug: 'test-group',
        organizerUserId: 'org-1',
        reason: undefined,
      })
      expect(mockNotifyGroupCompleted).not.toHaveBeenCalled()
    })

    it('notifies owner and applicants after completion', async () => {
      mockExisting('FULL')
      prisma.group.update.mockResolvedValue(makeGroup({ status: 'COMPLETED' }))

      await groupService.updateGroup(
        'test-group',
        { status: 'COMPLETED' },
        makeOrganizerContext({ userId: 'org-1' }),
      )

      expect(mockNotifyGroupCompleted).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'group-1', slug: 'test-group', organizerUserId: 'org-1' }),
      )
      expect(mockNotifyGroupCancelled).not.toHaveBeenCalled()
    })

    it('passes an existing rejection reason through as the cancellation reason', async () => {
      mockExisting('PUBLISHED', { rejectionReason: 'Не вказано кваліфікацію' })
      prisma.group.update.mockResolvedValue(makeGroup({ status: 'CANCELLED' }))

      await groupService.updateGroup(
        'test-group',
        { status: 'CANCELLED' },
        makeOrganizerContext({ userId: 'org-1' }),
      )

      expect(mockNotifyGroupCancelled).toHaveBeenCalledWith(
        expect.objectContaining({ reason: 'Не вказано кваліфікацію' }),
      )
    })

    it('stays quiet when the status did not change', async () => {
      mockExisting('PUBLISHED')
      prisma.group.update.mockResolvedValue(makeGroup({ status: 'PUBLISHED' }))

      await groupService.updateGroup(
        'test-group',
        { description: 'Just the description' },
        makeOrganizerContext({ userId: 'org-1' }),
      )

      expect(mockNotifyGroupCancelled).not.toHaveBeenCalled()
      expect(mockNotifyGroupCompleted).not.toHaveBeenCalled()
    })
  })

  describe('reopening a FULL group by raising its capacity', () => {
    function mockFull(capacity: number | null) {
      prisma.group.findFirst.mockResolvedValue({
        ...makePublishedGroup({ status: 'FULL', capacity }),
      })
      prisma.group.update.mockResolvedValue(makeGroup({ status: 'PUBLISHED' }))
    }

    it('reopens when the new capacity leaves room for the approvals already made', async () => {
      mockFull(10)
      prisma.application.count.mockResolvedValue(10)

      await groupService.updateGroup(
        'my-group',
        { maxParticipants: 12 },
        makeOrganizerContext({ userId: 'org-1' }),
      )

      expect(prisma.group.update.mock.calls[0][0].data.status).toBe('PUBLISHED')
    })

    it('reopens when the capacity limit is removed entirely', async () => {
      mockFull(10)
      prisma.application.count.mockResolvedValue(10)

      await groupService.updateGroup(
        'my-group',
        { maxParticipants: null },
        makeOrganizerContext({ userId: 'org-1' }),
      )

      expect(prisma.group.update.mock.calls[0][0].data.status).toBe('PUBLISHED')
    })

    it('stays FULL when the new capacity is still reached', async () => {
      mockFull(10)
      prisma.application.count.mockResolvedValue(10)

      await groupService.updateGroup(
        'my-group',
        { maxParticipants: 10 },
        makeOrganizerContext({ userId: 'org-1' }),
      )

      expect(prisma.group.update.mock.calls[0][0].data.status).toBeUndefined()
    })

    it('does not touch the status when capacity was not part of the patch', async () => {
      mockFull(10)

      await groupService.updateGroup(
        'my-group',
        { minParticipants: 3 },
        makeOrganizerContext({ userId: 'org-1' }),
      )

      expect(prisma.group.update.mock.calls[0][0].data.status).toBeUndefined()
      expect(prisma.application.count).not.toHaveBeenCalled()
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

  describe('auto-revert on critical field change', () => {
    // One entry per critical field: a patch that touches only that field and genuinely
    // differs from the stored row. Dates and capacity are spelled the way the validator
    // hands them over — startDate/endDate/maxParticipants — because that is the vocabulary
    // the trigger matches against, not the startsAt/endsAt/capacity columns they write to.
    const criticalPatches: { field: keyof UpdateGroupInput, patch: UpdateGroupInput }[] = [
      { field: 'title', patch: { title: 'Renamed group' } },
      { field: 'description', patch: { description: 'A different description' } },
      { field: 'type', patch: { type: 'THERAPEUTIC' } },
      { field: 'format', patch: { format: 'OFFLINE' } },
      { field: 'location', patch: { location: 'Lviv' } },
      { field: 'priceAmount', patch: { priceAmount: 600 } },
      { field: 'currency', patch: { currency: 'EUR' } },
      { field: 'startDate', patch: { startDate: '2026-12-01T10:00:00.000Z' } },
      { field: 'endDate', patch: { endDate: '2026-12-02T10:00:00.000Z' } },
      { field: 'maxParticipants', patch: { maxParticipants: 20 } },
    ]

    beforeEach(() => {
      prisma.group.findFirst.mockResolvedValue(makePublishedGroup())
      prisma.group.update.mockResolvedValue(
        makeGroup({ status: 'PENDING_REVIEW', title: 'My Group', slug: 'my-group' }),
      )
    })

    const writtenStatus = () => prisma.group.update.mock.calls[0][0].data.status

    it.each(criticalPatches)(
      'reverts a PUBLISHED group to PENDING_REVIEW when $field changes',
      async ({ field, patch }) => {
        const { notifyAdminsGroupPendingReview, notifyGroupAutoReverted, notifyGroupSubmitted }
          = await import('~~/server/utils/notifications')

        await groupService.updateGroup('my-group', patch, makeOrganizerContext({ userId: 'org-1' }))

        expect(writtenStatus()).toBe('PENDING_REVIEW')
        // The rejection reason of a previous moderation round must not survive the revert.
        expect(prisma.group.update.mock.calls[0][0].data.rejectionReason).toBeNull()
        expect(notifyAdminsGroupPendingReview).toHaveBeenCalledWith('My Group', 'my-group')
        expect(notifyGroupAutoReverted)
          .toHaveBeenCalledWith('org-1', 'My Group', 'my-group', [field])
        expect(notifyGroupSubmitted).not.toHaveBeenCalled()
      },
    )

    it('reverts on an unchanged resubmission of the date and capacity fields too', async () => {
      const { notifyGroupAutoReverted } = await import('~~/server/utils/notifications')

      // The edit form resends its whole payload on every autosave, and the trigger is
      // presence based on purpose: an edited published group must not stay published. Only
      // the wording of the email narrows to what really differs, so the list is empty here.
      await groupService.updateGroup(
        'my-group',
        {
          startDate: '2026-11-01T10:00:00.000Z',
          endDate: null,
          maxParticipants: 12,
        },
        makeOrganizerContext({ userId: 'org-1' }),
      )

      expect(writtenStatus()).toBe('PENDING_REVIEW')
      expect(notifyGroupAutoReverted).toHaveBeenCalledWith('org-1', 'My Group', 'my-group', [])
    })

    it('leaves a PUBLISHED group published when only program changes', async () => {
      const { notifyAdminsGroupPendingReview, notifyGroupAutoReverted, notifyGroupSubmitted }
        = await import('~~/server/utils/notifications')

      await groupService.updateGroup(
        'my-group',
        { program: '1. Знайомство\n2. Вправи на заземлення' },
        makeOrganizerContext({ userId: 'org-1' }),
      )

      expect(writtenStatus()).toBeUndefined()
      expect(notifyAdminsGroupPendingReview).not.toHaveBeenCalled()
      expect(notifyGroupAutoReverted).not.toHaveBeenCalled()
      expect(notifyGroupSubmitted).not.toHaveBeenCalled()
    })

    it('leaves a PUBLISHED group published when only the remaining non-critical fields change', async () => {
      const { notifyGroupAutoReverted } = await import('~~/server/utils/notifications')

      await groupService.updateGroup(
        'my-group',
        { minParticipants: 4, durationHours: 12, certificateIssued: true },
        makeOrganizerContext({ userId: 'org-1' }),
      )

      expect(writtenStatus()).toBeUndefined()
      expect(notifyGroupAutoReverted).not.toHaveBeenCalled()
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

  // An admin ending a group is the same event as the owner doing it, so it has to go
  // through the same state machine and the same fan-out.
  describe('ending a group from moderation', () => {
    function mockModerationRow(currentStatus: string, nextStatus = currentStatus) {
      prisma.group.findUnique.mockResolvedValue({
        id: 'group-1',
        status: currentStatus,
        title: 'Test Group',
        slug: 'test-group',
      })
      prisma.group.update.mockResolvedValue({
        id: 'group-1',
        status: nextStatus,
        title: 'Test Group',
        slug: 'test-group',
        rejectionReason: null,
        organizer: { userId: 'org-1', user: { preferredLocale: 'ua' } },
      })
    }

    it('cancels a published group and tells the owner and the approved applicants', async () => {
      mockModerationRow('PUBLISHED', 'CANCELLED')

      await groupService.moderateGroup('group-1', 'CANCELLED')

      expect(prisma.group.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: 'CANCELLED', rejectionReason: null } }),
      )
      expect(mockNotifyGroupCancelled).toHaveBeenCalledWith({
        id: 'group-1',
        title: 'Test Group',
        slug: 'test-group',
        organizerUserId: 'org-1',
      })
    })

    it('marks a full group completed', async () => {
      mockModerationRow('FULL', 'COMPLETED')

      await groupService.moderateGroup('group-1', 'COMPLETED')

      expect(mockNotifyGroupCompleted).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'group-1', organizerUserId: 'org-1' }),
      )
      expect(mockNotifyGroupCancelled).not.toHaveBeenCalled()
    })

    it('refuses to cancel a group that was never public', async () => {
      mockModerationRow('DRAFT')

      await expect(groupService.moderateGroup('group-1', 'CANCELLED')).rejects.toBeInstanceOf(ValidationError)
      expect(prisma.group.update).not.toHaveBeenCalled()
    })

    it('refuses to touch a group that is already completed', async () => {
      mockModerationRow('COMPLETED')

      await expect(groupService.moderateGroup('group-1', 'CANCELLED')).rejects.toBeInstanceOf(ValidationError)
      expect(mockNotifyGroupCancelled).not.toHaveBeenCalled()
    })
  })
})

describe('groupService.deleteGroup', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  function mockGroupForDelete(status: string, overrides: Record<string, unknown> = {}) {
    // deleteGroup reads through findBySlugWithOrganizer, which is a findUnique on the slug.
    prisma.group.findUnique.mockResolvedValue({
      id: 'group-1',
      slug: 'test-group',
      status,
      organizer: { id: 'profile-1', userId: 'org-1' },
      ...overrides,
    })
  }

  it('throws 404 when the group does not exist', async () => {
    prisma.group.findUnique.mockResolvedValue(null)

    await expect(
      groupService.deleteGroup('nope', { userId: 'org-1', role: 'ORGANIZER' }),
    ).rejects.toBeInstanceOf(NotFoundError)
  })

  it('deletes a draft the caller owns', async () => {
    mockGroupForDelete('DRAFT')
    prisma.application.count.mockResolvedValue(0)
    prisma.group.delete.mockResolvedValue({ id: 'group-1' })

    const result = await groupService.deleteGroup('test-group', { userId: 'org-1', role: 'ORGANIZER' })

    expect(result).toEqual({ success: true })
    expect(prisma.group.delete).toHaveBeenCalledWith({ where: { id: 'group-1' } })
  })

  it('deletes a rejected group, which can still hold applications from before it fell back', async () => {
    mockGroupForDelete('REJECTED')
    prisma.application.count.mockResolvedValue(0)
    prisma.group.delete.mockResolvedValue({ id: 'group-1' })

    await expect(
      groupService.deleteGroup('test-group', { userId: 'org-1', role: 'ORGANIZER' }),
    ).resolves.toEqual({ success: true })
  })

  it('lets an admin delete a group they do not own', async () => {
    mockGroupForDelete('DRAFT')
    prisma.application.count.mockResolvedValue(0)
    prisma.group.delete.mockResolvedValue({ id: 'group-1' })

    await expect(
      groupService.deleteGroup('test-group', { userId: 'admin-1', role: 'ADMIN' }),
    ).resolves.toEqual({ success: true })
  })

  it('refuses a co-organizer, who may edit but not destroy', async () => {
    // A real co-organizer, not a stranger: `application.manage` and `group.edit` both
    // admit them, so the delete refusal has to come from `group.delete` alone.
    mockGroupForDelete('DRAFT', { coOrganizers: [{ userId: 'org-2', role: 'CO_ORGANIZER' }] })
    prisma.application.count.mockResolvedValue(0)

    await expect(
      groupService.deleteGroup('test-group', { userId: 'org-2', role: 'ORGANIZER' }),
    ).rejects.toBeInstanceOf(ForbiddenError)
    expect(prisma.group.delete).not.toHaveBeenCalled()
  })

  it('refuses an organizer with no connection to the group at all', async () => {
    mockGroupForDelete('DRAFT')
    prisma.application.count.mockResolvedValue(0)

    await expect(
      groupService.deleteGroup('test-group', { userId: 'org-2', role: 'ORGANIZER' }),
    ).rejects.toBeInstanceOf(ForbiddenError)
    expect(prisma.group.delete).not.toHaveBeenCalled()
  })

  it('still lets the owner delete a group that has co-organizers', async () => {
    // The refusal above has to be about the caller, not about the group having a team.
    mockGroupForDelete('DRAFT', { coOrganizers: [{ userId: 'org-2', role: 'CO_ORGANIZER' }] })
    prisma.application.count.mockResolvedValue(0)
    prisma.group.delete.mockResolvedValue({ id: 'group-1' })

    await expect(
      groupService.deleteGroup('test-group', { userId: 'org-1', role: 'ORGANIZER' }),
    ).resolves.toEqual({ success: true })
  })

  it.each(['PUBLISHED', 'FULL', 'PENDING_REVIEW', 'COMPLETED', 'CANCELLED'])(
    'refuses to delete a %s group — cancel it instead',
    async (status) => {
      mockGroupForDelete(status)

      await expect(
        groupService.deleteGroup('test-group', { userId: 'org-1', role: 'ORGANIZER' }),
      ).rejects.toBeInstanceOf(ForbiddenError)
      expect(prisma.group.delete).not.toHaveBeenCalled()
    },
  )

  // `Application.groupId` cascades, so deleting a group that collected applicants used to
  // take every application, answer, question, favorite and review with it and tell no one.
  it.each(['PENDING', 'APPROVED'])(
    'refuses when a %s application is still live on the group',
    async () => {
      mockGroupForDelete('REJECTED')
      prisma.application.count.mockResolvedValue(1)

      await expect(
        groupService.deleteGroup('test-group', { userId: 'org-1', role: 'ORGANIZER' }),
      ).rejects.toBeInstanceOf(HasApplicationsError)
      expect(prisma.group.delete).not.toHaveBeenCalled()
    },
  )

  it('counts pending and approved together, and ignores withdrawn and rejected ones', async () => {
    mockGroupForDelete('REJECTED')
    prisma.application.count.mockResolvedValue(0)
    prisma.group.delete.mockResolvedValue({ id: 'group-1' })

    await groupService.deleteGroup('test-group', { userId: 'org-1', role: 'ORGANIZER' })

    expect(prisma.application.count).toHaveBeenCalledWith({
      where: { groupId: 'group-1', status: { in: ['PENDING', 'APPROVED'] } },
    })
  })

  it('refuses an admin too when applicants are waiting', async () => {
    mockGroupForDelete('DRAFT')
    prisma.application.count.mockResolvedValue(3)

    await expect(
      groupService.deleteGroup('test-group', { userId: 'admin-1', role: 'ADMIN' }),
    ).rejects.toBeInstanceOf(HasApplicationsError)
  })
})
