import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('~~/server/utils/prisma', () => ({ prisma: globalThis.prisma }))

vi.mock('~~/server/utils/notifications', () => ({
  notifyApplicationReceived: vi.fn(),
  notifyApplicationStatusChanged: vi.fn(),
  notifyApplicationSubmitted: vi.fn(),
  notifyApplicationWithdrawn: vi.fn(),
}))

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- globalThis.prisma is set in test setup
const prisma = globalThis.prisma as any

// eslint-disable-next-line import/first -- import must follow vi.mock()
import { applicationService } from '../../server/services/applicationService'
// eslint-disable-next-line import/first -- import must follow vi.mock()
import {
  NotFoundError,
  ValidationError,
  ConflictError,
  ForbiddenError,
  GroupEndedError,
  GroupFullError,
} from '../../server/utils/domainErrors'

const APPLY_INPUT = {
  name: 'Test',
  email: 'test@test.com',
  phone: '+380501234567',
  answers: [],
}

/** A group that is open for applications, overridable per test. */
function makeOpenGroup(overrides: Record<string, unknown> = {}) {
  return {
    id: 'group-1',
    status: 'PUBLISHED',
    title: 'Test Group',
    slug: 'test-group',
    capacity: null,
    startsAt: new Date('2026-11-01T10:00:00.000Z'),
    endsAt: new Date('2026-12-01T10:00:00.000Z'),
    questions: [],
    organizer: { userId: 'org-1', user: { preferredLocale: 'ua' } },
    ...overrides,
  }
}

describe('applicationService.create', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('group validation', () => {
    it('throws 404 when group does not exist', async () => {
      prisma.group.findUnique.mockResolvedValue(null)

      await expect(
        applicationService.create('nonexistent', {
          name: 'Test',
          email: 'test@test.com',
          phone: '+380501234567',
          answers: [],
        }),
      ).rejects.toBeInstanceOf(NotFoundError)
    })

    it('throws 404 when group is not PUBLISHED', async () => {
      prisma.group.findUnique.mockResolvedValue({
        id: 'group-1',
        status: 'DRAFT',
        title: 'Draft Group',
        slug: 'draft-group',
        questions: [],
        organizer: { userId: 'org-1', user: { preferredLocale: 'ua' } },
      })

      await expect(
        applicationService.create('draft-group', {
          name: 'Test',
          email: 'test@test.com',
          phone: '+380501234567',
          answers: [],
        }),
      ).rejects.toBeInstanceOf(NotFoundError)
    })

    // A hidden group answers exactly like a bad slug, so the endpoint cannot be used to
    // probe for the existence of groups nobody is meant to see.
    it.each(['DRAFT', 'PENDING_REVIEW', 'REJECTED', 'CANCELLED'])(
      'throws 404 rather than revealing a %s group exists',
      async (status) => {
        prisma.group.findUnique.mockResolvedValue(makeOpenGroup({ status }))

        await expect(
          applicationService.create('test-group', APPLY_INPUT),
        ).rejects.toBeInstanceOf(NotFoundError)
      },
    )
  })

  describe('a group that is visible but closed', () => {
    beforeEach(() => {
      vi.clearAllMocks()
    })

    it('refuses a FULL group with its own code, because a seat may free up', async () => {
      prisma.group.findUnique.mockResolvedValue(makeOpenGroup({ status: 'FULL' }))

      await expect(applicationService.create('test-group', APPLY_INPUT)).rejects.toBeInstanceOf(GroupFullError)
    })

    it('refuses a COMPLETED group with a code that says it will never reopen', async () => {
      prisma.group.findUnique.mockResolvedValue(makeOpenGroup({ status: 'COMPLETED' }))

      await expect(applicationService.create('test-group', APPLY_INPUT)).rejects.toBeInstanceOf(GroupEndedError)
    })

    it('refuses a group whose end date has passed even while the row still says PUBLISHED', async () => {
      // Nothing moves a row to COMPLETED automatically, so the date is the only thing that
      // closes it. Before this check a group that ran last month kept taking applications
      // and the organizer kept getting applicants for an event that had already happened.
      prisma.group.findUnique.mockResolvedValue(makeOpenGroup({
        status: 'PUBLISHED',
        startsAt: new Date('2020-01-01T10:00:00.000Z'),
        endsAt: new Date('2020-02-01T10:00:00.000Z'),
      }))

      await expect(applicationService.create('test-group', APPLY_INPUT)).rejects.toBeInstanceOf(GroupEndedError)
    })

    it('accepts a group with no end date, which has nothing to expire', async () => {
      prisma.group.findUnique.mockResolvedValue(makeOpenGroup({ endsAt: null }))
      prisma.application.findFirst.mockResolvedValue(null)
      prisma.application.create.mockResolvedValue({ id: 'app-1', status: 'PENDING' })

      await expect(applicationService.create('test-group', APPLY_INPUT)).resolves.toBeDefined()
    })

    it('accepts a group that ends in the future', async () => {
      prisma.group.findUnique.mockResolvedValue(makeOpenGroup({
        endsAt: new Date(Date.now() + 86_400_000),
      }))
      prisma.application.findFirst.mockResolvedValue(null)
      prisma.application.create.mockResolvedValue({ id: 'app-1', status: 'PENDING' })

      await expect(applicationService.create('test-group', APPLY_INPUT)).resolves.toBeDefined()
    })

    it('still reports a full group as full when its dates have also passed', async () => {
      // Order matters for the message the visitor reads: "no places" invites them to wait
      // for a seat, "already over" does not.
      prisma.group.findUnique.mockResolvedValue(makeOpenGroup({
        status: 'FULL',
        endsAt: new Date('2020-02-01T10:00:00.000Z'),
      }))

      await expect(applicationService.create('test-group', APPLY_INPUT)).rejects.toBeInstanceOf(GroupFullError)
    })
  })

  describe('answer validation', () => {
    it('throws 400 when answer references non-existent question', async () => {
      prisma.group.findUnique.mockResolvedValue({
        id: 'group-1',
        status: 'PUBLISHED',
        title: 'Test',
        slug: 'test',
        questions: [
          { id: 'q-1', question: 'Why?', type: 'TEXT', required: false, options: [] },
        ],
        organizer: { userId: 'org-1', user: { preferredLocale: 'ua' } },
      })

      await expect(
        applicationService.create('test-group', {
          name: 'Test',
          email: 'test@test.com',
          phone: '+380501234567',
          answers: [{ questionId: 'q-nonexistent', value: 'Because' }],
        }),
      ).rejects.toBeInstanceOf(ValidationError)
    })

    it('throws 400 when required question is empty', async () => {
      prisma.group.findUnique.mockResolvedValue({
        id: 'group-1',
        status: 'PUBLISHED',
        title: 'Test',
        slug: 'test',
        questions: [
          { id: 'q-1', question: 'Motivation', type: 'TEXT', required: true, options: [] },
        ],
        organizer: { userId: 'org-1', user: { preferredLocale: 'ua' } },
      })

      await expect(
        applicationService.create('test-group', {
          name: 'Test',
          email: 'test@test.com',
          phone: '+380501234567',
          answers: [{ questionId: 'q-1', value: '' }],
        }),
      ).rejects.toBeInstanceOf(ValidationError)
    })

    it('throws 400 when required question has only whitespace', async () => {
      prisma.group.findUnique.mockResolvedValue({
        id: 'group-1',
        status: 'PUBLISHED',
        title: 'Test',
        slug: 'test',
        questions: [
          { id: 'q-1', question: 'Motivation', type: 'TEXT', required: true, options: [] },
        ],
        organizer: { userId: 'org-1', user: { preferredLocale: 'ua' } },
      })

      await expect(
        applicationService.create('test-group', {
          name: 'Test',
          email: 'test@test.com',
          phone: '+380501234567',
          answers: [{ questionId: 'q-1', value: '   ' }],
        }),
      ).rejects.toBeInstanceOf(ValidationError)
    })

    it('throws 400 when answers array is empty but required questions exist', async () => {
      prisma.group.findUnique.mockResolvedValue({
        id: 'group-1',
        status: 'PUBLISHED',
        title: 'Test',
        slug: 'test',
        questions: [
          { id: 'q-1', question: 'Motivation', type: 'TEXT', required: true, options: [] },
        ],
        organizer: { userId: 'org-1', user: { preferredLocale: 'ua' } },
      })

      await expect(
        applicationService.create('test-group', {
          name: 'Test',
          email: 'test@test.com',
          phone: '+380501234567',
          answers: [],
        }),
      ).rejects.toBeInstanceOf(ValidationError)
    })

    it('throws 400 for invalid SINGLE_CHOICE option', async () => {
      prisma.group.findUnique.mockResolvedValue({
        id: 'group-1',
        status: 'PUBLISHED',
        title: 'Test',
        slug: 'test',
        questions: [
          { id: 'q-1', question: 'Format', type: 'SINGLE_CHOICE', required: false, options: ['Online', 'Offline'] },
        ],
        organizer: { userId: 'org-1', user: { preferredLocale: 'ua' } },
      })

      await expect(
        applicationService.create('test-group', {
          name: 'Test',
          email: 'test@test.com',
          phone: '+380501234567',
          answers: [{ questionId: 'q-1', value: 'Hybrid' }],
        }),
      ).rejects.toBeInstanceOf(ValidationError)
    })

    it('throws 400 for invalid MULTIPLE_CHOICE options', async () => {
      prisma.group.findUnique.mockResolvedValue({
        id: 'group-1',
        status: 'PUBLISHED',
        title: 'Test',
        slug: 'test',
        questions: [
          { id: 'q-1', question: 'Topics', type: 'MULTIPLE_CHOICE', required: false, options: ['Anxiety', 'Depression', 'Stress'] },
        ],
        organizer: { userId: 'org-1', user: { preferredLocale: 'ua' } },
      })

      await expect(
        applicationService.create('test-group', {
          name: 'Test',
          email: 'test@test.com',
          phone: '+380501234567',
          answers: [{ questionId: 'q-1', value: 'Anxiety, Phobias' }],
        }),
      ).rejects.toBeInstanceOf(ValidationError)
    })

    it('accepts valid SINGLE_CHOICE answer', async () => {
      prisma.group.findUnique.mockResolvedValue({
        id: 'group-1',
        status: 'PUBLISHED',
        title: 'Test Group',
        slug: 'test-group',
        questions: [
          { id: 'q-1', question: 'Format', type: 'SINGLE_CHOICE', required: false, options: ['Online', 'Offline'] },
        ],
        organizer: { userId: 'org-1', user: { preferredLocale: 'ua' } },
      })

      prisma.application.findFirst.mockResolvedValue(null)

      prisma.application.create.mockResolvedValue({
        id: 'app-1',
        status: 'PENDING',
        createdAt: new Date(),
      })

      const result = await applicationService.create('test-group', {
        name: 'Test',
        email: 'test@test.com',
        phone: '+380501234567',
        answers: [{ questionId: 'q-1', value: 'Online' }],
      })

      expect(result.application.status).toBe('PENDING')
    })
  })

  describe('userId attachment', () => {
    it('attaches userId when authenticated user applies', async () => {
      prisma.group.findUnique.mockResolvedValue({
        id: 'group-1',
        status: 'PUBLISHED',
        title: 'Test Group',
        slug: 'test-group',
        questions: [],
        organizer: { userId: 'org-1', user: { preferredLocale: 'ua' } },
      })

      prisma.application.findFirst.mockResolvedValue(null)

      prisma.application.create.mockResolvedValue({
        id: 'app-1',
        status: 'PENDING',
        createdAt: new Date(),
      })

      await applicationService.create('test-group', {
        name: 'Test',
        email: 'test@test.com',
        phone: '+380501234567',
        answers: [],
      }, { userId: 'user-1' })

      const createCall = prisma.application.create.mock.calls[0][0]
      expect(createCall.data.userId).toBe('user-1')
      expect(createCall.data.email).toBe('test@test.com')
    })

    it('does not attach userId for anonymous application', async () => {
      prisma.group.findUnique.mockResolvedValue({
        id: 'group-1',
        status: 'PUBLISHED',
        title: 'Test Group',
        slug: 'test-group',
        questions: [],
        organizer: { userId: 'org-1', user: { preferredLocale: 'ua' } },
      })

      prisma.application.findFirst.mockResolvedValue(null)

      prisma.application.create.mockResolvedValue({
        id: 'app-1',
        status: 'PENDING',
        createdAt: new Date(),
      })

      await applicationService.create('test-group', {
        name: 'Test',
        email: 'anon@test.com',
        phone: '+380501234567',
        answers: [],
      })

      const createCall = prisma.application.create.mock.calls[0][0]
      expect(createCall.data.userId).toBeUndefined()
    })

    it('checks duplicate by userId when authenticated', async () => {
      prisma.group.findUnique.mockResolvedValue({
        id: 'group-1',
        status: 'PUBLISHED',
        title: 'Test',
        slug: 'test',
        questions: [],
        organizer: { userId: 'org-1', user: { preferredLocale: 'ua' } },
      })

      prisma.application.findFirst.mockResolvedValue({
        id: 'existing-app',
        userId: 'user-1',
      })

      await expect(
        applicationService.create('test-group', {
          name: 'Test',
          email: 'different@test.com',
          phone: '+380501234567',
          answers: [],
        }, { userId: 'user-1' }),
      ).rejects.toBeInstanceOf(ConflictError)
    })
  })

  describe('duplicate prevention', () => {
    it('throws 400 on duplicate email for same group', async () => {
      prisma.group.findUnique.mockResolvedValue({
        id: 'group-1',
        status: 'PUBLISHED',
        title: 'Test',
        slug: 'test',
        questions: [],
        organizer: { userId: 'org-1', user: { preferredLocale: 'ua' } },
      })

      prisma.application.findFirst.mockResolvedValue({
        id: 'existing-app',
      })

      await expect(
        applicationService.create('test-group', {
          name: 'Test',
          email: 'duplicate@test.com',
          phone: '+380501234567',
          answers: [],
        }),
      ).rejects.toBeInstanceOf(ConflictError)
    })
  })

  describe('applicant acknowledgement', () => {
    beforeEach(() => {
      prisma.group.findUnique.mockResolvedValue({
        id: 'group-1',
        status: 'PUBLISHED',
        title: 'Test Group',
        slug: 'test-group',
        questions: [],
        organizer: { userId: 'org-1', user: { preferredLocale: 'ua' } },
      })
      prisma.application.findFirst.mockResolvedValue(null)
      prisma.application.create.mockResolvedValue({
        id: 'app-1',
        status: 'PENDING',
        createdAt: new Date(),
      })
    })

    it('notifies both sides of one application', async () => {
      const { notifyApplicationReceived, notifyApplicationSubmitted }
        = await import('~~/server/utils/notifications')

      await applicationService.create('test-group', {
        name: 'Іван Петренко',
        email: 'ivan@test.com',
        phone: '+380501234567',
        answers: [],
      })

      expect(notifyApplicationReceived)
        .toHaveBeenCalledWith('org-1', 'Іван Петренко', 'Test Group', 'test-group', 'ua')
      // No group id: the acknowledgement's `entityId` is the slug, because that is what
      // `notificationRoute` turns into a `/groups/<slug>` link that resolves.
      expect(notifyApplicationSubmitted)
        .toHaveBeenCalledWith('ivan@test.com', 'Іван Петренко', 'Test Group', 'test-group')
    })

    it('sends no acknowledgement for an application rejected as a duplicate', async () => {
      const { notifyApplicationSubmitted } = await import('~~/server/utils/notifications')
      prisma.application.findFirst.mockResolvedValue({ id: 'existing-app' })

      await expect(
        applicationService.create('test-group', {
          name: 'Іван Петренко',
          email: 'duplicate@test.com',
          phone: '+380501234567',
          answers: [],
        }),
      ).rejects.toBeInstanceOf(ConflictError)

      expect(notifyApplicationSubmitted).not.toHaveBeenCalled()
    })
  })
})

describe('applicationService.updateStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prisma.$queryRaw.mockReset().mockResolvedValue([{ status: 'PUBLISHED', capacity: null }])
  })

  it('throws 404 when group does not exist', async () => {
    prisma.group.findUnique.mockResolvedValue(null)

    await expect(
      applicationService.updateStatus('nonexistent', 'app-1', 'APPROVED', {
        userId: 'org-1',
        role: 'ORGANIZER',
      }),
    ).rejects.toBeInstanceOf(NotFoundError)
  })

  it('throws 403 when user is not the organizer', async () => {
    prisma.group.findUnique.mockResolvedValue({
      id: 'group-1',
      title: 'Test',
      slug: 'test',
      organizer: { userId: 'org-1' },
      coOrganizers: [],
    })

    await expect(
      applicationService.updateStatus('test-group', 'app-1', 'APPROVED', {
        userId: 'org-other',
        role: 'ORGANIZER',
      }),
    ).rejects.toBeInstanceOf(ForbiddenError)
  })

  // The queue itself (`application.viewForGroup`) has always admitted co-organizers, so
  // before `application.manage` agreed with it a co-organizer could read every applicant
  // and then collect a 403 from the approve button under it.
  it('lets a co-organizer approve, matching who may read the queue', async () => {
    prisma.group.findUnique.mockResolvedValue({
      id: 'group-1',
      title: 'Test Group',
      slug: 'test-group',
      capacity: null,
      status: 'PUBLISHED',
      organizer: { userId: 'org-1' },
      coOrganizers: [{ userId: 'co-1' }],
    })
    prisma.application.findFirst.mockResolvedValue({ id: 'app-1', groupId: 'group-1' })
    prisma.application.update.mockResolvedValue({
      id: 'app-1',
      name: 'Test',
      email: 'test@test.com',
      status: 'APPROVED',
      createdAt: new Date(),
    })

    const result = await applicationService.updateStatus(
      'test-group',
      'app-1',
      'APPROVED',
      { userId: 'co-1', role: 'ORGANIZER' },
    )

    expect(result.application.status).toBe('APPROVED')
  })

  it('lets a co-organizer reject too', async () => {
    prisma.group.findUnique.mockResolvedValue({
      id: 'group-1',
      title: 'Test Group',
      slug: 'test-group',
      capacity: null,
      status: 'PUBLISHED',
      organizer: { userId: 'org-1' },
      coOrganizers: [{ userId: 'co-1' }],
    })
    prisma.application.findFirst.mockResolvedValue({ id: 'app-1', groupId: 'group-1' })
    prisma.application.update.mockResolvedValue({
      id: 'app-1',
      name: 'Test',
      email: 'test@test.com',
      status: 'REJECTED',
      createdAt: new Date(),
    })

    await expect(
      applicationService.updateStatus('test-group', 'app-1', 'REJECTED', {
        userId: 'co-1',
        role: 'ORGANIZER',
      }, 'Місць не залишилося'),
    ).resolves.toBeDefined()
  })

  it('still refuses an organizer who is neither owner nor co-organizer', async () => {
    prisma.group.findUnique.mockResolvedValue({
      id: 'group-1',
      title: 'Test',
      slug: 'test',
      organizer: { userId: 'org-1' },
      coOrganizers: [{ userId: 'co-1' }],
    })

    await expect(
      applicationService.updateStatus('test-group', 'app-1', 'APPROVED', {
        userId: 'org-other',
        role: 'ORGANIZER',
      }),
    ).rejects.toBeInstanceOf(ForbiddenError)

    expect(prisma.application.update).not.toHaveBeenCalled()
  })

  it('refuses a visitor even when the group has no co-organizers', async () => {
    prisma.group.findUnique.mockResolvedValue({
      id: 'group-1',
      title: 'Test',
      slug: 'test',
      organizer: { userId: 'org-1' },
      coOrganizers: [],
    })

    await expect(
      applicationService.updateStatus('test-group', 'app-1', 'APPROVED', {
        userId: 'visitor-1',
        role: 'VISITOR',
      }),
    ).rejects.toBeInstanceOf(ForbiddenError)
  })

  it('allows admin to update status', async () => {
    prisma.group.findUnique.mockResolvedValue({
      id: 'group-1',
      title: 'Test Group',
      slug: 'test-group',
      capacity: null,
      status: 'PUBLISHED',
      organizer: { userId: 'org-1' },
      coOrganizers: [],
    })

    prisma.application.findFirst.mockResolvedValue({
      id: 'app-1',
      groupId: 'group-1',
    })

    prisma.application.update.mockResolvedValue({
      id: 'app-1',
      name: 'Test',
      email: 'test@test.com',
      status: 'APPROVED',
      createdAt: new Date(),
    })

    const result = await applicationService.updateStatus(
      'test-group',
      'app-1',
      'APPROVED',
      { userId: 'admin-1', role: 'ADMIN' },
    )

    expect(result.application.status).toBe('APPROVED')
  })

  it('throws 404 when application does not exist', async () => {
    prisma.group.findUnique.mockResolvedValue({
      id: 'group-1',
      title: 'Test',
      slug: 'test',
      organizer: { userId: 'org-1' },
      coOrganizers: [],
    })

    prisma.application.findFirst.mockResolvedValue(null)

    await expect(
      applicationService.updateStatus('test-group', 'app-nonexistent', 'APPROVED', {
        userId: 'org-1',
        role: 'ORGANIZER',
      }),
    ).rejects.toBeInstanceOf(NotFoundError)
  })

  describe('seats', () => {
    function mockGroup(overrides: Record<string, unknown> = {}) {
      const capacity = overrides.capacity === undefined ? 2 : overrides.capacity
      const status = overrides.status ?? 'PUBLISHED'

      prisma.group.findUnique.mockResolvedValue({
        id: 'group-1',
        title: 'Test Group',
        slug: 'test-group',
        capacity,
        status,
        organizer: { userId: 'org-1' },
        coOrganizers: [],
        ...overrides,
      })
      // `groupRepository.lockById` — the row lock, which also hands back the seat state the
      // arithmetic below has to trust instead of the pre-lock read.
      prisma.$queryRaw.mockResolvedValue([{ status, capacity }])
      prisma.application.findFirst.mockResolvedValue({ id: 'app-1', groupId: 'group-1' })
      prisma.application.update.mockResolvedValue({
        id: 'app-1',
        name: 'Test',
        email: 'test@test.com',
        status: 'APPROVED',
        createdAt: new Date(),
      })
      // Default the counts so the post-commit seat re-read has something to return; the
      // tests below queue their own values on top for the checks that need a sequence.
      prisma.application.count.mockResolvedValue(0)
    }

    const asOwner = { userId: 'org-1', role: 'ORGANIZER' }
    // Rejecting without one is a 400, so every rejection below has to carry it.
    const REASON = 'Група вже заповнена'

    it('locks the group row inside the transaction before it counts a single seat', async () => {
      // Two approvals racing on the last seat both counted the same number and both wrote,
      // so the group ended up over capacity with nothing anywhere reporting an error. The
      // lock is what serializes them; it is worthless unless it is taken first and inside
      // the transaction that does the counting.
      mockGroup()

      const order: string[] = []
      prisma.$queryRaw.mockImplementation(async () => {
        order.push('lock')
        return [{ status: 'PUBLISHED', capacity: 2 }]
      })
      prisma.application.count.mockImplementation(async () => {
        order.push('count')
        return 0
      })

      await applicationService.updateStatus('test-group', 'app-1', 'APPROVED', asOwner)

      expect(order[0]).toBe('lock')
      expect(order).toContain('count')
      expect(prisma.$queryRaw).toHaveBeenCalledTimes(1)
    })

    it('trusts the seat state read under the lock, not the one from before it', async () => {
      // The pre-lock read said two seats and PUBLISHED; by the time the lock was granted a
      // concurrent approval had taken the last one and closed the group.
      mockGroup({ capacity: 2, status: 'PUBLISHED' })
      prisma.$queryRaw.mockResolvedValue([{ status: 'FULL', capacity: 1 }])
      prisma.application.count.mockResolvedValue(1)

      await expect(
        applicationService.updateStatus('test-group', 'app-1', 'APPROVED', asOwner),
      ).rejects.toBeInstanceOf(GroupFullError)

      expect(prisma.application.update).not.toHaveBeenCalled()
    })

    it('refuses an approval that would pass capacity, with the same code the public form gets', async () => {
      mockGroup()
      prisma.application.count.mockResolvedValue(2)

      await expect(
        applicationService.updateStatus('test-group', 'app-1', 'APPROVED', asOwner),
      ).rejects.toBeInstanceOf(GroupFullError)

      expect(prisma.application.update).not.toHaveBeenCalled()
    })

    it('marks the group FULL when an approval takes the last seat', async () => {
      mockGroup()
      // First count is the pre-check (1 of 2 taken), second is the recount after the write.
      prisma.application.count.mockResolvedValueOnce(1).mockResolvedValueOnce(2)

      await applicationService.updateStatus('test-group', 'app-1', 'APPROVED', asOwner)

      expect(prisma.group.update).toHaveBeenCalledWith({
        where: { id: 'group-1' },
        data: { status: 'FULL' },
      })
    })

    it('leaves the group PUBLISHED while a seat is still free', async () => {
      mockGroup()
      prisma.application.count.mockResolvedValueOnce(0).mockResolvedValueOnce(1)

      await applicationService.updateStatus('test-group', 'app-1', 'APPROVED', asOwner)

      expect(prisma.group.update).not.toHaveBeenCalled()
    })

    it('reopens a FULL group when a rejection frees the last seat', async () => {
      // The only way out of FULL: without it a full group stayed full forever, because the
      // capacity check above refuses the approval that would have triggered a recount.
      mockGroup({ status: 'FULL' })
      prisma.application.count.mockResolvedValue(1)

      await applicationService.updateStatus('test-group', 'app-1', 'REJECTED', asOwner, REASON)

      expect(prisma.group.update).toHaveBeenCalledWith({
        where: { id: 'group-1' },
        data: { status: 'PUBLISHED' },
      })
    })

    it('keeps a FULL group full when the rejection left it at capacity anyway', async () => {
      mockGroup({ status: 'FULL', capacity: 1 })
      prisma.application.count.mockResolvedValue(1)

      await applicationService.updateStatus('test-group', 'app-1', 'REJECTED', asOwner, REASON)

      expect(prisma.group.update).not.toHaveBeenCalled()
    })

    it('does not reopen a group that was never FULL', async () => {
      mockGroup({ status: 'PUBLISHED' })

      await applicationService.updateStatus('test-group', 'app-1', 'REJECTED', asOwner, REASON)

      expect(prisma.group.update).not.toHaveBeenCalled()
    })

    it('skips the seat arithmetic entirely for a group with no capacity', async () => {
      mockGroup({ capacity: null })
      prisma.$queryRaw.mockResolvedValue([{ status: 'PUBLISHED', capacity: null }])

      await applicationService.updateStatus('test-group', 'app-1', 'APPROVED', asOwner)

      expect(prisma.group.update).not.toHaveBeenCalled()
    })

    it('rolls the approval back with the group transition it caused', async () => {
      mockGroup()
      prisma.application.count.mockResolvedValueOnce(1).mockResolvedValueOnce(2)

      // A distinct tx object: if the service reached for the global client instead, these
      // spies would stay untouched and the writes would survive a rollback.
      const txApplicationUpdate = vi.fn().mockResolvedValue({ id: 'app-1', email: 'test@test.com' })
      const txGroupUpdate = vi.fn().mockResolvedValue({ id: 'group-1', status: 'FULL' })
      const tx = {
        ...prisma,
        application: { ...prisma.application, update: txApplicationUpdate },
        group: { ...prisma.group, update: txGroupUpdate },
      }
      prisma.$transaction.mockImplementationOnce((fn: (_tx: unknown) => unknown) => fn(tx))

      await applicationService.updateStatus('test-group', 'app-1', 'APPROVED', asOwner)

      expect(txApplicationUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'app-1' },
          // `rejectionReason` rides along on every write so an approval clears a reason left
          // by an earlier rejection instead of keeping it on an approved row.
          data: { status: 'APPROVED', rejectionReason: null },
        }),
      )
      expect(txGroupUpdate).toHaveBeenCalledWith({
        where: { id: 'group-1' },
        data: { status: 'FULL' },
      })
      expect(prisma.application.update).not.toHaveBeenCalled()
      expect(prisma.group.update).not.toHaveBeenCalled()
    })

    it('returns the fresh seat tally so the managing page does not have to recount', async () => {
      mockGroup()
      // Pre-check, post-write recount, then the count inside the seat re-read.
      prisma.application.count
        .mockResolvedValueOnce(1)
        .mockResolvedValueOnce(2)
        .mockResolvedValueOnce(2)
      // The re-read after the commit sees the FULL status the transaction wrote.
      prisma.group.findUnique.mockResolvedValueOnce({
        id: 'group-1',
        title: 'Test Group',
        slug: 'test-group',
        capacity: 2,
        status: 'PUBLISHED',
        organizer: { userId: 'org-1' },
        coOrganizers: [],
      }).mockResolvedValueOnce({
        slug: 'test-group',
        title: 'Test Group',
        status: 'FULL',
        capacity: 2,
      })

      const result = await applicationService.updateStatus('test-group', 'app-1', 'APPROVED', asOwner)

      expect(result.group).toEqual({
        slug: 'test-group',
        title: 'Test Group',
        status: 'FULL',
        capacity: 2,
        approvedCount: 2,
      })
    })

    it('seats exactly the capacity when ten approvals land at once', async () => {
      // What the row lock buys, modelled the way the database would run it: each approval
      // takes the lock, so the counts are serialized rather than interleaved. Without the
      // lock every one of these would read 0 and all ten would be approved.
      mockGroup({ capacity: 5 })

      let approved = 0
      const outcomes: Array<'APPROVED' | 'GROUP_FULL'> = []

      prisma.$queryRaw.mockImplementation(async () => [{ status: 'PUBLISHED', capacity: 5 }])
      prisma.application.findFirst.mockImplementation(
        async ({ where }: { where: { id: string } }) => ({ id: where.id, groupId: 'group-1' }),
      )
      prisma.application.count.mockImplementation(async () => approved)
      prisma.application.update.mockImplementation(async () => {
        approved += 1
        return { id: 'app', name: 'Test', email: 'a@test.com', status: 'APPROVED', createdAt: new Date() }
      })

      for (let seat = 0; seat < 10; seat += 1) {
        const outcome = await applicationService
          .updateStatus('test-group', `app-${seat}`, 'APPROVED', asOwner)
          .then(() => 'APPROVED' as const)
          .catch((error: unknown) => {
            if (error instanceof GroupFullError) return 'GROUP_FULL' as const
            throw error
          })

        outcomes.push(outcome)
      }

      expect(outcomes.filter(o => o === 'APPROVED')).toHaveLength(5)
      expect(outcomes.filter(o => o === 'GROUP_FULL')).toHaveLength(5)
      expect(approved).toBe(5)
    })
  })

  describe('rejection reason and reverting a decision', () => {
    const asOwner = { userId: 'org-1', role: 'ORGANIZER' }

    /**
     * A queue the owner may work, holding one application in `status`.
     *
     * `application.update` echoes its `data` back the way Prisma does, because
     * `updateStatus` notifies from the returned row rather than from the request — a static
     * mock would let a wrong reason through unnoticed.
     */
    function mockQueue(status: string, group: Record<string, unknown> = {}) {
      const capacity = group.capacity === undefined ? null : group.capacity
      const groupStatus = group.status ?? 'PUBLISHED'

      prisma.group.findUnique.mockResolvedValue({
        id: 'group-1',
        title: 'Test Group',
        slug: 'test-group',
        capacity,
        status: groupStatus,
        organizer: { userId: 'org-1' },
        coOrganizers: [],
        ...group,
      })
      prisma.$queryRaw.mockResolvedValue([{ status: groupStatus, capacity }])
      prisma.application.findFirst.mockResolvedValue({ id: 'app-1', groupId: 'group-1', status })
      prisma.application.update.mockImplementation(
        async ({ data }: { data: { status: string, rejectionReason: string | null } }) => ({
          id: 'app-1',
          name: 'Test',
          email: 'test@test.com',
          status: data.status,
          rejectionReason: data.rejectionReason,
          createdAt: new Date(),
        }),
      )
      prisma.application.count.mockResolvedValue(0)
    }

    it('refuses a rejection with no reason', async () => {
      mockQueue('PENDING')

      await expect(
        applicationService.updateStatus('test-group', 'app-1', 'REJECTED', asOwner),
      ).rejects.toBeInstanceOf(ValidationError)

      expect(prisma.application.update).not.toHaveBeenCalled()
    })

    it('refuses a rejection whose reason is only whitespace', async () => {
      mockQueue('PENDING')

      await expect(
        applicationService.updateStatus('test-group', 'app-1', 'REJECTED', asOwner, '    '),
      ).rejects.toBeInstanceOf(ValidationError)

      expect(prisma.application.update).not.toHaveBeenCalled()
    })

    it('stores the trimmed reason and quotes it to the applicant', async () => {
      mockQueue('PENDING')
      const { notifyApplicationStatusChanged } = await import('~~/server/utils/notifications')

      await applicationService.updateStatus(
        'test-group',
        'app-1',
        'REJECTED',
        asOwner,
        '  Група вже заповнена  ',
      )

      expect(prisma.application.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: 'REJECTED', rejectionReason: 'Група вже заповнена' },
        }),
      )
      expect(notifyApplicationStatusChanged).toHaveBeenCalledWith(
        'test@test.com',
        'Test Group',
        'test-group',
        'REJECTED',
        'Група вже заповнена',
      )
    })

    it('reverts a rejected application to pending and clears the reason', async () => {
      mockQueue('REJECTED')

      await applicationService.updateStatus('test-group', 'app-1', 'PENDING', asOwner)

      expect(prisma.application.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: 'PENDING', rejectionReason: null } }),
      )
    })

    it('refuses to revert an application that is still pending', async () => {
      mockQueue('PENDING')

      await expect(
        applicationService.updateStatus('test-group', 'app-1', 'PENDING', asOwner),
      ).rejects.toBeInstanceOf(ConflictError)

      expect(prisma.application.update).not.toHaveBeenCalled()
    })

    it('refuses to pull an approved application back to pending', async () => {
      // An approval holds a seat, so undoing it is a rejection — the transition that frees
      // the seat and reopens a FULL group — not a silent return to the queue.
      mockQueue('APPROVED')

      await expect(
        applicationService.updateStatus('test-group', 'app-1', 'PENDING', asOwner),
      ).rejects.toBeInstanceOf(ConflictError)

      expect(prisma.application.update).not.toHaveBeenCalled()
    })

    it('tells nobody about a revert', async () => {
      // No NotificationType or email template describes "we undid our rejection", and
      // re-using the rejection letter would say the opposite of what happened.
      mockQueue('REJECTED')
      const { notifyApplicationStatusChanged } = await import('~~/server/utils/notifications')

      await applicationService.updateStatus('test-group', 'app-1', 'PENDING', asOwner)

      expect(notifyApplicationStatusChanged).not.toHaveBeenCalled()
    })

    it('moves no seat when a rejection is reverted', async () => {
      mockQueue('REJECTED', { status: 'FULL', capacity: 2 })

      await applicationService.updateStatus('test-group', 'app-1', 'PENDING', asOwner)

      expect(prisma.group.update).not.toHaveBeenCalled()
    })
  })
})

// `Application.userId` is nullable and `apply.post.ts` reads auth optionally, so a
// guest application keeps `userId = NULL` on a clean database too. The email match
// below is permanent product behaviour, not a migration shim: it is what lets someone
// who applied as a guest and registered afterwards still withdraw that application.
describe('applicationService.withdraw', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const pendingApplication = (overrides: Record<string, unknown> = {}) => ({
    id: 'app-1',
    groupId: 'group-1',
    status: 'PENDING',
    name: 'Applicant',
    email: 'applicant@test.com',
    createdAt: new Date(),
    group: { id: 'group-1', slug: 'test-group' },
    answers: [],
    ...overrides,
  })

  const mockWithdrawn = () => {
    prisma.application.update.mockResolvedValue({
      id: 'app-1',
      name: 'Applicant',
      email: 'applicant@test.com',
      status: 'WITHDRAWN',
      createdAt: new Date(),
    })
    prisma.group.findUnique.mockResolvedValue({
      id: 'group-1',
      title: 'Test Group',
      slug: 'test-group',
      organizer: { userId: 'org-1' },
    })
  }

  it('throws 404 when the application does not exist', async () => {
    prisma.application.findUnique.mockResolvedValue(null)

    await expect(applicationService.withdraw('app-missing', 'user-1'))
      .rejects.toBeInstanceOf(NotFoundError)
  })

  it('throws 403 when the caller owns neither the userId nor the email', async () => {
    prisma.application.findUnique.mockResolvedValue(pendingApplication({ userId: 'user-owner' }))
    prisma.user.findUnique.mockResolvedValue({ id: 'user-someone-else' })

    await expect(applicationService.withdraw('app-1', 'user-intruder'))
      .rejects.toBeInstanceOf(ForbiddenError)
    expect(prisma.application.update).not.toHaveBeenCalled()
  })

  it('throws 403 when a guest application belongs to an unregistered email', async () => {
    prisma.application.findUnique.mockResolvedValue(pendingApplication({ userId: null }))
    prisma.user.findUnique.mockResolvedValue(null)

    await expect(applicationService.withdraw('app-1', 'user-1'))
      .rejects.toBeInstanceOf(ForbiddenError)
    expect(prisma.application.update).not.toHaveBeenCalled()
  })

  it('withdraws an application matched by userId without an email lookup', async () => {
    prisma.application.findUnique.mockResolvedValue(pendingApplication({ userId: 'user-1' }))
    mockWithdrawn()

    const result = await applicationService.withdraw('app-1', 'user-1')

    expect(result.application.status).toBe('WITHDRAWN')
    expect(prisma.user.findUnique).not.toHaveBeenCalled()
  })

  it('withdraws a guest application by email once the applicant has registered', async () => {
    prisma.application.findUnique.mockResolvedValue(pendingApplication({ userId: null }))
    prisma.user.findUnique.mockResolvedValue({ id: 'user-1' })
    mockWithdrawn()

    const result = await applicationService.withdraw('app-1', 'user-1')

    expect(result.application.status).toBe('WITHDRAWN')
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { email: 'applicant@test.com' },
      select: { id: true },
    })
  })

  it('throws 409 when the application is not PENDING', async () => {
    prisma.application.findUnique
      .mockResolvedValue(pendingApplication({ userId: 'user-1', status: 'APPROVED' }))

    await expect(applicationService.withdraw('app-1', 'user-1'))
      .rejects.toBeInstanceOf(ConflictError)
    expect(prisma.application.update).not.toHaveBeenCalled()
  })
})
