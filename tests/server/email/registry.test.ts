import { describe, it, expect } from 'vitest'
import { NotificationType } from '@prisma/client'
import {
  emailRegistry,
  notificationTypesWithoutEmail,
  templateForNotificationType,
} from '~~/server/services/email/registry'
import type { EmailTemplate } from '~~/server/services/email/types'

const templates = Object.keys(emailRegistry) as EmailTemplate[]
const notificationTypes = Object.values(NotificationType)

describe('email registry — coverage', () => {
  it('every NotificationType either has a template or a documented exception', () => {
    const unmapped = notificationTypes.filter(
      type => templateForNotificationType(type) === null,
    )

    for (const type of unmapped) {
      expect(
        notificationTypesWithoutEmail[type],
        `${type} has no email template and no documented reason`,
      ).toBeTruthy()
    }
  })

  it('every documented exception really has no template', () => {
    for (const type of Object.keys(notificationTypesWithoutEmail)) {
      expect(templateForNotificationType(type as typeof NotificationType)).toBeNull()
    }
  })

  it('maps every notification type except the one without a producer', () => {
    const mapped = notificationTypes.filter(type => templateForNotificationType(type) !== null)

    expect(mapped).toHaveLength(notificationTypes.length - 1)
    expect(mapped).not.toContain('GROUP_STARTING')
  })

  it('no two templates share a NotificationType', () => {
    const types = templates
      .map(template => emailRegistry[template].notificationType)
      .filter((type): type is NonNullable<typeof type> => type !== null)

    expect(new Set(types).size).toBe(types.length)
  })
})

describe('email registry — entry shape', () => {
  for (const template of templates) {
    it(`${template} declares subject, preheader and a renderer`, () => {
      const entry = emailRegistry[template]

      expect(entry.subjectKey).toMatch(/^subject\./)
      expect(entry.preheaderKey).toMatch(/\.preheader$/)
      expect(typeof entry.render).toBe('function')
    })
  }

  it('templateForNotificationType resolves both directions', () => {
    expect(templateForNotificationType('APPLICATION_APPROVED')).toBe('application_approved')
    expect(templateForNotificationType('GROUP_APPROVED')).toBe('group_published')
    expect(templateForNotificationType('ORGANIZER_APPROVED')).toBe('organizer_verified')
    expect(templateForNotificationType('GROUP_STARTING')).toBeNull()
  })
})
