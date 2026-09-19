import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('~~/server/utils/prisma', () => ({ prisma: globalThis.prisma }))

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

const mockCreateNotification = vi.mocked(createNotification)

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
    ).rejects.toMatchObject({ statusCode: 404 })
  })

  it('throws 400 when profile is not PENDING', async () => {
    prisma.organizerProfile.findUnique.mockResolvedValue({
      id: 'profile-1',
      verificationStatus: 'VERIFIED',
      user: { id: 'user-1', preferredLocale: 'ua' },
    })

    await expect(
      organizerService.moderateProfile('profile-1', 'VERIFIED', undefined, 'ORGANIZER_PROFILE'),
    ).rejects.toMatchObject({ statusCode: 400 })
  })

  it('throws 400 when rejecting without reason', async () => {
    prisma.organizerProfile.findUnique.mockResolvedValue({
      id: 'profile-1',
      verificationStatus: 'PENDING',
      user: { id: 'user-1', preferredLocale: 'ua' },
    })

    await expect(
      organizerService.moderateProfile('profile-1', 'REJECTED', undefined, 'ORGANIZER_PROFILE'),
    ).rejects.toMatchObject({ statusCode: 400, statusMessage: 'Rejection reason is required' })
  })

  it('throws 400 when rejecting with whitespace-only reason', async () => {
    prisma.organizerProfile.findUnique.mockResolvedValue({
      id: 'profile-1',
      verificationStatus: 'PENDING',
      user: { id: 'user-1', preferredLocale: 'ua' },
    })

    await expect(
      organizerService.moderateProfile('profile-1', 'REJECTED', '   ', 'ORGANIZER_PROFILE'),
    ).rejects.toMatchObject({ statusCode: 400, statusMessage: 'Rejection reason is required' })
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
    ).rejects.toMatchObject({ statusCode: 404 })
  })
})

describe('organizerService.verify', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('verifies a PENDING profile', async () => {
    prisma.organizerProfile.findUnique.mockResolvedValue({
      id: 'profile-1',
      verificationStatus: 'PENDING',
    })

    prisma.organizerProfile.update.mockResolvedValue({
      id: 'profile-1',
      verificationStatus: 'VERIFIED',
    })

    const result = await organizerService.verify('profile-1')

    expect(result).toEqual({
      id: 'profile-1',
      verificationStatus: 'VERIFIED',
    })
  })

  it('throws 404 when organizer not found', async () => {
    prisma.organizerProfile.findUnique.mockResolvedValue(null)

    await expect(
      organizerService.verify('nonexistent'),
    ).rejects.toMatchObject({ statusCode: 404 })
  })

  it('throws 409 when organizer is not in PENDING state', async () => {
    prisma.organizerProfile.findUnique.mockResolvedValue({
      id: 'profile-1',
      verificationStatus: 'VERIFIED',
    })

    await expect(
      organizerService.verify('profile-1'),
    ).rejects.toMatchObject({ statusCode: 409, statusMessage: 'Organizer is not in pending state' })
  })

  it('throws 409 for REJECTED profile', async () => {
    prisma.organizerProfile.findUnique.mockResolvedValue({
      id: 'profile-1',
      verificationStatus: 'REJECTED',
    })

    await expect(
      organizerService.verify('profile-1'),
    ).rejects.toMatchObject({ statusCode: 409 })
  })
})
