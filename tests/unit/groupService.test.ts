import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('~~/server/utils/prisma', () => ({ prisma: globalThis.prisma }))

vi.mock('~~/server/utils/notifications', () => ({
  notifyAdminsGroupPendingReview: vi.fn(),
  notifyGroupPublished: vi.fn(),
  notifyGroupRejected: vi.fn(),
}))

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- globalThis.prisma is set in test setup
const prisma = globalThis.prisma as any

// eslint-disable-next-line import/first -- import must follow vi.mock()
import { groupService } from '../../server/services/groupService'

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
      ).rejects.toMatchObject({ statusCode: 404 })
    })

    it('throws 403 when user is not owner, co-organizer or admin', async () => {
      prisma.group.findFirst.mockResolvedValue({
        ...makeGroup(),
        organizer: { id: 'profile-1', userId: 'org-1' },
        coOrganizers: [],
      })

      await expect(
        groupService.updateGroup('test-group', {}, makeOrganizerContext({ userId: 'org-other' })),
      ).rejects.toMatchObject({ statusCode: 403 })
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
      ).rejects.toMatchObject({ statusCode: 403 })
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

    it('organizer cannot submit PUBLISHED group for review', async () => {
      prisma.group.findFirst.mockResolvedValue({
        ...makeGroup({ status: 'PUBLISHED' }),
        organizer: { id: 'profile-1', userId: 'org-1' },
        coOrganizers: [],
      })

      await expect(
        groupService.updateGroup(
          'test-group',
          { status: 'PENDING_REVIEW' },
          makeOrganizerContext({ userId: 'org-1' }),
        ),
      ).rejects.toMatchObject({ statusCode: 400 })
    })

    it('organizer cannot change status of PUBLISHED group', async () => {
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
      ).rejects.toMatchObject({ statusCode: 403 })
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
      ).rejects.toMatchObject({ statusCode: 403 })
    })
  })

  describe('tag validation', () => {
    it('throws 400 when some tags do not exist', async () => {
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
      ).rejects.toMatchObject({ statusCode: 400, statusMessage: 'Some tags not found' })
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

      expect(notifyAdminsGroupPendingReview).toHaveBeenCalledWith('My Group', 'my-group')
    })

    it('does not notify when status stayed PENDING_REVIEW', async () => {
      const { notifyAdminsGroupPendingReview } = await import('~~/server/utils/notifications')

      prisma.group.findFirst.mockResolvedValue({
        ...makeGroup({ status: 'PENDING_REVIEW' }),
        organizer: { id: 'profile-1', userId: 'org-1' },
        coOrganizers: [],
      })

      prisma.group.update.mockResolvedValue(makeGroup({ status: 'PENDING_REVIEW' }))

      await groupService.updateGroup(
        'test-group',
        { status: 'PENDING_REVIEW', title: 'Updated title' },
        makeOrganizerContext({ userId: 'org-1' }),
      )

      expect(notifyAdminsGroupPendingReview).not.toHaveBeenCalled()
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
      ).rejects.toMatchObject({
        statusCode: 400,
        statusMessage: 'Can only approve groups with PENDING_REVIEW status',
      })
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
      ).rejects.toMatchObject({
        statusCode: 400,
        statusMessage: 'Can only reject groups with PENDING_REVIEW or PUBLISHED status',
      })
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
      ).rejects.toMatchObject({
        statusCode: 400,
        statusMessage: 'Rejection reason is required',
      })
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
      ).rejects.toMatchObject({
        statusCode: 400,
        statusMessage: 'Rejection reason is required',
      })
    })
  })

  describe('not found', () => {
    it('throws 404 when group does not exist', async () => {
      prisma.group.findUnique.mockResolvedValue(null)

      await expect(
        groupService.moderateGroup('nonexistent', 'PUBLISHED'),
      ).rejects.toMatchObject({ statusCode: 404 })
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
