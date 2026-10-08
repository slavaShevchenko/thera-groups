import { describe, it, expect, vi, beforeEach } from 'vitest'

const { fireAndForget } = vi.hoisted(() => ({ fireAndForget: vi.fn() }))

vi.mock('~~/server/utils/prisma', () => ({ prisma: globalThis.prisma }))
vi.mock('~~/server/services/email', () => ({ sendEmailFireAndForget: fireAndForget }))

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- globalThis.prisma is set in test setup
const prisma = globalThis.prisma as any

// eslint-disable-next-line import/first -- import must follow vi.mock()
import {
  notifyApplicationReceived,
  notifyApplicationStatusChanged,
  notifyApplicationSubmitted,
  notifyApplicationWithdrawn,
  notifyGroupAutoReverted,
  notifyGroupPublished,
  notifyGroupRejected,
  notifyGroupSubmitted,
  notifyOrganizerWelcome,
  notifyAdminsGroupPendingReview,
  notifyAdminsOrganizerPendingReview,
} from '~~/server/utils/notifications'

const organizerRow = {
  email: 'organizer@example.com',
  preferredLocale: 'ua',
  organizerProfile: { firstName: 'Олена', lastName: 'Коваленко' },
}

function sentEmail(callIndex = 0) {
  return fireAndForget.mock.calls[callIndex][0]
}

describe('notifications — application received', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prisma.user.findUnique.mockResolvedValue(organizerRow)
    prisma.notification.create.mockResolvedValue({ id: 'n1' })
  })

  it('creates the in-app notification as before', async () => {
    await notifyApplicationReceived('user-1', 'Іван', 'Група підтримки', 'support-group', 'ua')

    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
        type: 'APPLICATION_RECEIVED',
        entityType: 'group',
        entityId: 'support-group',
        title: 'Нова заявка',
        message: 'Іван подав заявку на групу «Група підтримки»',
      },
    })
  })

  it('emails the organizer using their own preferred locale', async () => {
    prisma.user.findUnique.mockResolvedValue({ ...organizerRow, preferredLocale: 'en' })

    await notifyApplicationReceived('user-1', 'Іван', 'Група підтримки', 'support-group', 'ua')

    expect(sentEmail()).toMatchObject({
      to: 'organizer@example.com',
      template: 'application_received',
      locale: 'en',
      entityId: 'support-group',
      data: {
        recipientName: 'Олена Коваленко',
        applicantName: 'Іван',
        groupTitle: 'Група підтримки',
        groupSlug: 'support-group',
      },
    })
  })

  it('sends no email when the organizer no longer exists', async () => {
    prisma.user.findUnique.mockResolvedValue(null)

    await notifyApplicationReceived('user-1', 'Іван', 'Група', 'support-group')

    expect(prisma.notification.create).toHaveBeenCalledOnce()
    expect(fireAndForget).not.toHaveBeenCalled()
  })

  it('falls back to a generic greeting for a user without an organizer profile', async () => {
    prisma.user.findUnique.mockResolvedValue({
      email: 'visitor@example.com',
      preferredLocale: 'ua',
      organizerProfile: null,
    })

    await notifyApplicationReceived('user-1', 'Іван', 'Група', 'support-group')

    expect(sentEmail().data.recipientName).toBeUndefined()
  })
})

describe('notifications — application submitted (applicant ack)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prisma.notification.create.mockResolvedValue({ id: 'n1' })
  })

  it('emails an unregistered applicant and creates no in-app notification', async () => {
    prisma.user.findUnique.mockResolvedValue(null)

    await notifyApplicationSubmitted('visitor@example.com', 'Іван Петренко', 'Група підтримки', 'support-group')

    expect(sentEmail()).toMatchObject({
      to: 'visitor@example.com',
      template: 'application_submitted',
      locale: 'ua',
      entityId: 'support-group',
      data: {
        recipientName: 'Іван Петренко',
        groupTitle: 'Група підтримки',
        groupSlug: 'support-group',
      },
    })
    expect(prisma.notification.create).not.toHaveBeenCalled()
  })

  it('creates both an email and a notification for a registered applicant', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'user-9', preferredLocale: 'en' })

    await notifyApplicationSubmitted('applicant@example.com', 'Ivan', 'Support group', 'support-group', 'group-1')

    expect(sentEmail()).toMatchObject({ template: 'application_submitted', locale: 'en' })
    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'user-9',
        type: 'APPLICATION_SUBMITTED',
        entityType: 'group',
        entityId: 'group-1',
      }),
    })
  })

  it('falls back to the group slug when no group id is given', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'user-9', preferredLocale: 'ua' })

    await notifyApplicationSubmitted('applicant@example.com', 'Іван', 'Група', 'support-group')

    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ entityId: 'support-group' }),
    })
  })

  it('never puts application answers or the address into the email payload', async () => {
    prisma.user.findUnique.mockResolvedValue(null)

    await notifyApplicationSubmitted('visitor@example.com', 'Іван', 'Група', 'support-group')

    expect(Object.keys(sentEmail().data).sort()).toEqual(['groupSlug', 'groupTitle', 'recipientName'])
    expect(sentEmail().data).not.toMatchObject({ recipientName: 'visitor@example.com' })
  })
})

describe('notifications — application status changed', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prisma.notification.create.mockResolvedValue({ id: 'n1' })
  })

  it('emails an unregistered applicant and skips the in-app notification', async () => {
    prisma.user.findUnique.mockResolvedValue(null)

    await notifyApplicationStatusChanged('visitor@example.com', 'Група', 'support-group', 'APPROVED', 'group-1')

    expect(sentEmail()).toMatchObject({
      to: 'visitor@example.com',
      template: 'application_approved',
      locale: 'ua',
      entityId: 'support-group',
      data: { groupTitle: 'Група', groupSlug: 'support-group' },
    })
    expect(prisma.notification.create).not.toHaveBeenCalled()
  })

  it('creates both an email and a notification for a registered applicant', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'user-9', preferredLocale: 'en' })

    await notifyApplicationStatusChanged('applicant@example.com', 'Group', 'support-group', 'APPROVED', 'group-1')

    expect(sentEmail()).toMatchObject({ template: 'application_approved', locale: 'en' })
    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'user-9',
        type: 'APPLICATION_APPROVED',
        entityId: 'group-1',
      }),
    })
  })

  it('uses the rejected template and type for a rejection', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'user-9', preferredLocale: 'ua' })

    await notifyApplicationStatusChanged('applicant@example.com', 'Група', 'support-group', 'REJECTED')

    expect(sentEmail().template).toBe('application_rejected')
    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ type: 'APPLICATION_REJECTED', entityId: 'support-group' }),
    })
  })

  it('never puts application answers into the email payload', async () => {
    prisma.user.findUnique.mockResolvedValue(null)

    await notifyApplicationStatusChanged('visitor@example.com', 'Група', 'support-group', 'APPROVED')

    expect(Object.keys(sentEmail().data).sort()).toEqual(['groupSlug', 'groupTitle'])
  })
})

describe('notifications — application withdrawn', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prisma.user.findUnique.mockResolvedValue(organizerRow)
    prisma.notification.create.mockResolvedValue({ id: 'n1' })
  })

  it('creates a localized notification and emails the organizer', async () => {
    await notifyApplicationWithdrawn('user-1', 'Іван', 'Група підтримки', 'support-group', 'app-1')

    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'user-1',
        type: 'APPLICATION_WITHDRAWN',
        entityType: 'application',
        entityId: 'app-1',
        title: 'Заявку відкликано',
      }),
    })
    expect(sentEmail()).toMatchObject({
      to: 'organizer@example.com',
      template: 'application_withdrawn',
      locale: 'ua',
      data: expect.objectContaining({ applicantName: 'Іван', groupSlug: 'support-group' }),
    })
  })

  it('still notifies in-app when the organizer account is gone', async () => {
    prisma.user.findUnique.mockResolvedValue(null)

    await notifyApplicationWithdrawn('user-1', 'Іван', 'Група', 'support-group', 'app-1')

    expect(prisma.notification.create).toHaveBeenCalledOnce()
    expect(fireAndForget).not.toHaveBeenCalled()
  })
})

describe('notifications — group moderation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prisma.user.findUnique.mockResolvedValue(organizerRow)
    prisma.notification.create.mockResolvedValue({ id: 'n1' })
  })

  it('emails the organizer when a group is published', async () => {
    await notifyGroupPublished('user-1', 'Група підтримки', 'support-group', 'ua')

    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ type: 'GROUP_APPROVED', title: 'Вашу групу опубліковано' }),
    })
    expect(sentEmail()).toMatchObject({
      template: 'group_published',
      entityId: 'support-group',
      data: expect.objectContaining({ groupSlug: 'support-group' }),
    })
  })

  it('passes the rejection reason through to the email', async () => {
    await notifyGroupRejected('user-1', 'Група', 'support-group', 'Не вистачає опису', 'ua')

    expect(sentEmail()).toMatchObject({
      template: 'group_rejected',
      data: expect.objectContaining({ reason: 'Не вистачає опису' }),
    })
    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ type: 'GROUP_REJECTED' }),
    })
  })
})

describe('notifications — group submitted for review', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prisma.user.findUnique.mockResolvedValue(organizerRow)
    prisma.notification.create.mockResolvedValue({ id: 'n1' })
  })

  it('notifies and emails the owner in their own locale', async () => {
    await notifyGroupSubmitted('user-1', 'Група підтримки', 'support-group')

    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'user-1',
        type: 'GROUP_SUBMITTED',
        entityType: 'group',
        entityId: 'support-group',
        title: 'Групу надіслано на модерацію',
      }),
    })
    expect(sentEmail()).toMatchObject({
      to: 'organizer@example.com',
      template: 'group_submitted',
      locale: 'ua',
      entityId: 'support-group',
      data: {
        recipientName: 'Олена Коваленко',
        groupTitle: 'Група підтримки',
        groupSlug: 'support-group',
      },
    })
  })

  it('still writes the in-app notification when the owner account is gone', async () => {
    prisma.user.findUnique.mockResolvedValue(null)

    await notifyGroupSubmitted('user-1', 'Група', 'support-group')

    expect(prisma.notification.create).toHaveBeenCalledOnce()
    expect(fireAndForget).not.toHaveBeenCalled()
  })
})

describe('notifications — group auto-reverted to review', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prisma.user.findUnique.mockResolvedValue(organizerRow)
    prisma.notification.create.mockResolvedValue({ id: 'n1' })
  })

  it('names the changed critical fields with localized labels', async () => {
    await notifyGroupAutoReverted('user-1', 'Група підтримки', 'support-group', ['title', 'priceAmount'])

    expect(sentEmail()).toMatchObject({
      template: 'group_auto_revert',
      locale: 'ua',
      entityId: 'support-group',
      data: {
        recipientName: 'Олена Коваленко',
        groupTitle: 'Група підтримки',
        groupSlug: 'support-group',
        changedFields: 'назва, вартість участі',
      },
    })
    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ type: 'GROUP_AUTO_REVERT', entityId: 'support-group' }),
    })
  })

  it('localizes the field labels for an English-speaking owner', async () => {
    prisma.user.findUnique.mockResolvedValue({ ...organizerRow, preferredLocale: 'en' })

    await notifyGroupAutoReverted('user-1', 'Support group', 'support-group', ['startDate', 'maxParticipants'])

    expect(sentEmail()).toMatchObject({
      locale: 'en',
      data: expect.objectContaining({ changedFields: 'start date, number of places' }),
    })
  })

  it('falls back to the raw field name when a field has no label', async () => {
    await notifyGroupAutoReverted('user-1', 'Група', 'support-group', ['someNewField'])

    expect(sentEmail().data.changedFields).toBe('someNewField')
  })

  it('sends an empty field list rather than a broken sentence when nothing really changed', async () => {
    await notifyGroupAutoReverted('user-1', 'Група', 'support-group', [])

    expect(sentEmail().data.changedFields).toBe('')
  })

  it('is a separate message from the admin one on the same transition', async () => {
    prisma.user.findMany.mockResolvedValue([
      { id: 'a1', email: 'admin1@example.com', preferredLocale: 'ua', organizerProfile: null },
    ])

    await notifyAdminsGroupPendingReview('Група підтримки', 'support-group')
    await notifyGroupAutoReverted('user-1', 'Група підтримки', 'support-group', ['title'])

    expect(fireAndForget).toHaveBeenCalledTimes(2)
    expect(sentEmail(0)).toMatchObject({ to: 'admin1@example.com', template: 'group_pending_review' })
    expect(sentEmail(1)).toMatchObject({ to: 'organizer@example.com', template: 'group_auto_revert' })
  })
})

describe('notifications — organizer welcome', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prisma.notification.create.mockResolvedValue({ id: 'n1' })
  })

  it('greets the new organizer and links the private profile', async () => {
    await notifyOrganizerWelcome('user-1', 'organizer@example.com', 'Іван', 'ivan-petrenko', 'ua')

    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'user-1',
        type: 'ORGANIZER_WELCOME',
        entityType: 'organizerProfile',
        entityId: 'ivan-petrenko',
        title: 'Профіль організатора створено',
      }),
    })
    expect(sentEmail()).toMatchObject({
      to: 'organizer@example.com',
      template: 'organizer_welcome',
      locale: 'ua',
      entityId: 'ivan-petrenko',
      data: { recipientName: 'Іван' },
    })
  })

  it('honours the locale chosen at registration', async () => {
    await notifyOrganizerWelcome('user-1', 'organizer@example.com', 'Ivan', 'ivan', 'en')

    expect(sentEmail()).toMatchObject({ locale: 'en' })
    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ title: 'Organizer profile created' }),
    })
  })

  it('defaults to Ukrainian for an unknown locale', async () => {
    await notifyOrganizerWelcome('user-1', 'organizer@example.com', 'Іван', 'ivan', 'fr')

    expect(sentEmail()).toMatchObject({ locale: 'ua' })
  })
})

describe('notifications — admin fan-out', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prisma.notification.create.mockResolvedValue({ id: 'n1' })
  })

  it('notifies and emails every admin in their own locale', async () => {
    prisma.user.findMany.mockResolvedValue([
      { id: 'a1', email: 'admin1@example.com', preferredLocale: 'ua', organizerProfile: null },
      {
        id: 'a2',
        email: 'admin2@example.com',
        preferredLocale: 'en',
        organizerProfile: { firstName: 'Ann', lastName: 'Admin' },
      },
    ])

    await notifyAdminsGroupPendingReview('Група підтримки', 'support-group')

    expect(prisma.notification.create).toHaveBeenCalledTimes(2)
    expect(fireAndForget).toHaveBeenCalledTimes(2)
    expect(sentEmail(0)).toMatchObject({
      to: 'admin1@example.com',
      locale: 'ua',
      template: 'group_pending_review',
      entityId: 'support-group',
      data: { recipientName: undefined, groupTitle: 'Група підтримки' },
    })
    expect(sentEmail(1)).toMatchObject({
      to: 'admin2@example.com',
      locale: 'en',
      data: expect.objectContaining({ recipientName: 'Ann Admin' }),
    })
  })

  it('notifies admins about a profile pending verification', async () => {
    prisma.user.findMany.mockResolvedValue([
      { id: 'a1', email: 'admin1@example.com', preferredLocale: 'ua', organizerProfile: null },
    ])

    await notifyAdminsOrganizerPendingReview('Іван Петренко', 'ivan-petrorenko')

    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: 'ORGANIZER_PENDING_REVIEW',
        entityType: 'organizerProfile',
        entityId: 'ivan-petrorenko',
      }),
    })
    expect(sentEmail()).toMatchObject({
      template: 'organizer_pending_review',
      data: expect.objectContaining({ organizerName: 'Іван Петренко' }),
    })
  })

  it('does nothing when there are no admins', async () => {
    prisma.user.findMany.mockResolvedValue([])

    await notifyAdminsGroupPendingReview('Група', 'support-group')

    expect(prisma.notification.create).not.toHaveBeenCalled()
    expect(fireAndForget).not.toHaveBeenCalled()
  })

  it('passes the transaction through to the notification writes', async () => {
    prisma.user.findMany.mockResolvedValue([
      { id: 'a1', email: 'admin1@example.com', preferredLocale: 'ua', organizerProfile: null },
    ])
    const tx = prisma

    await notifyAdminsGroupPendingReview('Група', 'support-group', tx)

    expect(prisma.notification.create).toHaveBeenCalledTimes(1)
  })
})
