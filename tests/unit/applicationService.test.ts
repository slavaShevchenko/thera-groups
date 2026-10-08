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
import { NotFoundError, ValidationError, ConflictError, ForbiddenError } from '../../server/utils/domainErrors'

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
      expect(notifyApplicationSubmitted)
        .toHaveBeenCalledWith('ivan@test.com', 'Іван Петренко', 'Test Group', 'test-group', 'group-1')
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
  })

  it('throws 404 when group does not exist', async () => {
    prisma.group.findUnique.mockResolvedValue(null)

    await expect(
      applicationService.updateStatus('nonexistent', 'app-1', 'APPROVED', {
        userId: 'org-1',
        isAdmin: false,
      }),
    ).rejects.toBeInstanceOf(NotFoundError)
  })

  it('throws 403 when user is not the organizer', async () => {
    prisma.group.findUnique.mockResolvedValue({
      id: 'group-1',
      title: 'Test',
      slug: 'test',
      organizer: { userId: 'org-1' },
    })

    await expect(
      applicationService.updateStatus('test-group', 'app-1', 'APPROVED', {
        userId: 'org-other',
        isAdmin: false,
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
      { userId: 'admin-1', isAdmin: true },
    )

    expect(result.application.status).toBe('APPROVED')
  })

  it('throws 404 when application does not exist', async () => {
    prisma.group.findUnique.mockResolvedValue({
      id: 'group-1',
      title: 'Test',
      slug: 'test',
      organizer: { userId: 'org-1' },
    })

    prisma.application.findFirst.mockResolvedValue(null)

    await expect(
      applicationService.updateStatus('test-group', 'app-nonexistent', 'APPROVED', {
        userId: 'org-1',
        isAdmin: false,
      }),
    ).rejects.toBeInstanceOf(NotFoundError)
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
