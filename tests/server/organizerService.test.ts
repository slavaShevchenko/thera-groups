import { describe, it, expect, vi, beforeEach } from 'vitest'

const { fireAndForget } = vi.hoisted(() => ({ fireAndForget: vi.fn() }))

vi.mock('~~/server/utils/prisma', () => ({ prisma: globalThis.prisma }))

vi.mock('~~/server/services/email', () => ({ sendEmailFireAndForget: fireAndForget }))

vi.mock('~~/server/utils/notifications', () => ({
  createNotification: vi.fn(),
  notifyAdminsOrganizerPendingReview: vi.fn(),
}))

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- globalThis.prisma is set in test setup
const prisma = globalThis.prisma as any

// eslint-disable-next-line import/first -- import must follow vi.mock()
import { organizerService } from '../../server/services/organizerService'
// eslint-disable-next-line import/first -- import must follow vi.mock()
import { createNotification } from '~~/server/utils/notifications'
// eslint-disable-next-line import/first -- import must follow vi.mock()
import { NotFoundError, ValidationError } from '../../server/utils/domainErrors'

const mockCreateNotification = vi.mocked(createNotification)

/**
 * `PATCH /admin/organizer-profiles/[id]` is the only route into moderateProfile, so the email
 * half is asserted here at the service level rather than through the handler.
 */
function sentEmail() {
  return fireAndForget.mock.calls[0][0]
}

describe('organizerService.moderateProfile', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('verifies a PENDING profile and sends notification', async () => {
    prisma.organizerProfile.findUnique.mockResolvedValue({
      id: 'profile-1',
      slug: 'john-doe',
      verificationStatus: 'PENDING',
      firstName: 'John',
      lastName: 'Doe',
      user: { id: 'user-1', preferredLocale: 'ua' },
    })

    prisma.organizerProfile.update.mockResolvedValue({
      id: 'profile-1',
      slug: 'john-doe',
      verificationStatus: 'VERIFIED',
    })

    const result = await organizerService.moderateProfile(
      'profile-1',
      'VERIFIED',
      undefined,
      'ORGANIZER_PROFILE',
    )

    expect(result).toEqual({
      id: 'profile-1',
      slug: 'john-doe',
      verificationStatus: 'VERIFIED',
    })

    expect(prisma.organizerProfile.update).toHaveBeenCalledWith({
      where: { id: 'profile-1' },
      data: { verificationStatus: 'VERIFIED', rejectionReason: null },
    })

    expect(mockCreateNotification).toHaveBeenCalledWith(
      'user-1',
      'ORGANIZER_PROFILE',
      'organizerProfile',
      'john-doe',
      expect.any(String),
      expect.any(String),
    )
  })

  it('rejects a PENDING profile with reason and sends notification', async () => {
    prisma.organizerProfile.findUnique.mockResolvedValue({
      id: 'profile-1',
      slug: 'john-doe',
      verificationStatus: 'PENDING',
      firstName: 'John',
      lastName: 'Doe',
      user: { id: 'user-1', preferredLocale: 'en' },
    })

    prisma.organizerProfile.update.mockResolvedValue({
      id: 'profile-1',
      slug: 'john-doe',
      verificationStatus: 'REJECTED',
    })

    const result = await organizerService.moderateProfile(
      'profile-1',
      'REJECTED',
      'Incomplete documents',
      'ORGANIZER_PROFILE',
    )

    expect(result.verificationStatus).toBe('REJECTED')

    expect(prisma.organizerProfile.update).toHaveBeenCalledWith({
      where: { id: 'profile-1' },
      data: { verificationStatus: 'REJECTED', rejectionReason: 'Incomplete documents' },
    })

    expect(mockCreateNotification).toHaveBeenCalled()
  })

  it('throws 404 when profile not found', async () => {
    prisma.organizerProfile.findUnique.mockResolvedValue(null)

    await expect(
      organizerService.moderateProfile('nonexistent', 'VERIFIED', undefined, 'ORGANIZER_PROFILE'),
    ).rejects.toBeInstanceOf(NotFoundError)
  })

  it('throws 400 when profile is not PENDING', async () => {
    prisma.organizerProfile.findUnique.mockResolvedValue({
      id: 'profile-1',
      verificationStatus: 'VERIFIED',
      user: { id: 'user-1', preferredLocale: 'ua' },
    })

    await expect(
      organizerService.moderateProfile('profile-1', 'VERIFIED', undefined, 'ORGANIZER_PROFILE'),
    ).rejects.toBeInstanceOf(ValidationError)
  })

  it('throws 400 when rejecting without reason', async () => {
    prisma.organizerProfile.findUnique.mockResolvedValue({
      id: 'profile-1',
      verificationStatus: 'PENDING',
      user: { id: 'user-1', preferredLocale: 'ua' },
    })

    await expect(
      organizerService.moderateProfile('profile-1', 'REJECTED', undefined, 'ORGANIZER_PROFILE'),
    ).rejects.toBeInstanceOf(ValidationError)
  })

  it('throws 400 when rejecting with whitespace-only reason', async () => {
    prisma.organizerProfile.findUnique.mockResolvedValue({
      id: 'profile-1',
      verificationStatus: 'PENDING',
      user: { id: 'user-1', preferredLocale: 'ua' },
    })

    await expect(
      organizerService.moderateProfile('profile-1', 'REJECTED', '   ', 'ORGANIZER_PROFILE'),
    ).rejects.toBeInstanceOf(ValidationError)
  })
})

describe('organizerService.toggleActive', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('toggles isActive from true to false', async () => {
    prisma.organizerProfile.findUnique.mockResolvedValue({
      id: 'profile-1',
      userId: 'user-1',
      user: { id: 'user-1', isActive: true },
    })

    prisma.user.update.mockResolvedValue({
      id: 'user-1',
      isActive: false,
    })

    const result = await organizerService.toggleActive('profile-1')

    expect(result).toEqual({ id: 'profile-1', isActive: false })

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { isActive: false },
    })
  })

  it('toggles isActive from false to true', async () => {
    prisma.organizerProfile.findUnique.mockResolvedValue({
      id: 'profile-1',
      userId: 'user-1',
      user: { id: 'user-1', isActive: false },
    })

    prisma.user.update.mockResolvedValue({
      id: 'user-1',
      isActive: true,
    })

    const result = await organizerService.toggleActive('profile-1')

    expect(result).toEqual({ id: 'profile-1', isActive: true })
  })

  it('throws 404 when organizer not found', async () => {
    prisma.organizerProfile.findUnique.mockResolvedValue(null)

    await expect(
      organizerService.toggleActive('nonexistent'),
    ).rejects.toBeInstanceOf(NotFoundError)
  })
})

describe('organizerService.moderateProfile — email', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prisma.organizerProfile.update.mockResolvedValue({
      id: 'profile-1',
      slug: 'john-doe',
      verificationStatus: 'VERIFIED',
    })
  })

  function pendingProfile(preferredLocale = 'ua') {
    prisma.organizerProfile.findUnique.mockResolvedValue({
      id: 'profile-1',
      slug: 'john-doe',
      verificationStatus: 'PENDING',
      firstName: 'John',
      lastName: 'Doe',
      user: { id: 'user-1', email: 'john@example.com', preferredLocale },
    })
  }

  it('emails the organizer when a profile is verified', async () => {
    pendingProfile()

    await organizerService.moderateProfile('profile-1', 'VERIFIED', undefined, 'ORGANIZER_APPROVED')

    expect(sentEmail()).toMatchObject({
      to: 'john@example.com',
      template: 'organizer_verified',
      locale: 'ua',
      entityId: 'john-doe',
      data: { recipientName: 'John Doe', organizerName: 'John Doe' },
    })
  })

  it('emails in the organizer’s own locale', async () => {
    pendingProfile('en')

    await organizerService.moderateProfile('profile-1', 'VERIFIED', undefined, 'ORGANIZER_APPROVED')

    expect(sentEmail()).toMatchObject({ locale: 'en' })
  })

  it('emails the rejection reason when a profile is rejected', async () => {
    pendingProfile()
    prisma.organizerProfile.update.mockResolvedValue({
      id: 'profile-1',
      slug: 'john-doe',
      verificationStatus: 'REJECTED',
    })

    await organizerService.moderateProfile(
      'profile-1',
      'REJECTED',
      'Incomplete documents',
      'ORGANIZER_REJECTED',
    )

    expect(sentEmail()).toMatchObject({
      template: 'organizer_rejected',
      data: expect.objectContaining({ reason: 'Incomplete documents' }),
    })
  })

  it('sends nothing when the profile cannot be moderated', async () => {
    prisma.organizerProfile.findUnique.mockResolvedValue({
      id: 'profile-1',
      verificationStatus: 'VERIFIED',
      user: { id: 'user-1', email: 'john@example.com', preferredLocale: 'ua' },
    })

    await expect(
      organizerService.moderateProfile('profile-1', 'VERIFIED', undefined, 'ORGANIZER_APPROVED'),
    ).rejects.toBeInstanceOf(ValidationError)

    expect(fireAndForget).not.toHaveBeenCalled()
  })
})
