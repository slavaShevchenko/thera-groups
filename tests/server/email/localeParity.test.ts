import { describe, it, expect } from 'vitest'
import { emailTranslationKeys, tEmail, t } from '~~/server/i18n'
import { emailRegistry } from '~~/server/services/email/registry'
import type { EmailTemplate } from '~~/server/services/email/types'
import notificationUa from '~~/server/i18n/notifications/ua'
import notificationEn from '~~/server/i18n/notifications/en'

const locales = ['ua', 'en'] as const
const templates = Object.keys(emailRegistry) as EmailTemplate[]

describe('email locale parity', () => {
  it('ua and en expose exactly the same keys', () => {
    expect([...emailTranslationKeys.ua].sort()).toEqual([...emailTranslationKeys.en].sort())
  })

  it('has no empty values in either locale', () => {
    for (const locale of locales) {
      for (const key of emailTranslationKeys[locale]) {
        expect(tEmail(key, locale).trim(), `${locale}:${key}`).not.toBe('')
      }
    }
  })

  it('every key resolves to a translation rather than to itself', () => {
    for (const locale of locales) {
      for (const key of emailTranslationKeys[locale]) {
        expect(tEmail(key, locale), `${locale}:${key} did not resolve`).not.toBe(key)
      }
    }
  })

  it('an unknown key resolves to the key itself, never to the other locale', () => {
    expect(tEmail('does.not.exist', 'en')).toBe('does.not.exist')
  })
})

describe('email registry keys exist in both locales', () => {
  for (const template of templates) {
    const { subjectKey, preheaderKey } = emailRegistry[template]

    it(`${template}: ${subjectKey} and ${preheaderKey}`, () => {
      for (const locale of locales) {
        expect(tEmail(subjectKey, locale), `${locale}:${subjectKey}`).not.toBe(subjectKey)
        expect(tEmail(preheaderKey, locale), `${locale}:${preheaderKey}`).not.toBe(preheaderKey)
      }
    })
  }
})

describe('phase 1 email keys exist in both locales', () => {
  // Named explicitly so a dropped key fails with its own message instead of only surfacing
  // as one line in the whole-dictionary comparison above.
  const phase1Keys = [
    'subject.applicationSubmitted',
    'applicationSubmitted.preheader',
    'applicationSubmitted.body1',
    'applicationSubmitted.body2',
    'subject.organizerWelcome',
    'organizerWelcome.preheader',
    'organizerWelcome.body1',
    'organizerWelcome.body2',
    'subject.groupSubmitted',
    'groupSubmitted.preheader',
    'groupSubmitted.body1',
    'groupSubmitted.body2',
    'subject.groupAutoRevert',
    'groupAutoRevert.preheader',
    'groupAutoRevert.body1',
    'groupAutoRevert.changedFields',
    'groupAutoRevert.body2',
  ]

  for (const key of phase1Keys) {
    it(key, () => {
      for (const locale of locales) {
        expect(tEmail(key, locale), `${locale}:${key}`).not.toBe(key)
      }
    })
  }

  // The auto-revert message names update-payload fields, so each one needs a label; an
  // unmapped field degrades to its raw camelCase name rather than to an i18n key.
  const criticalFieldKeys = [
    'title', 'description', 'type', 'format', 'location',
    'priceAmount', 'currency', 'startDate', 'endDate', 'maxParticipants',
  ]

  for (const field of criticalFieldKeys) {
    it(`field.${field}`, () => {
      for (const locale of locales) {
        expect(tEmail(`field.${field}`, locale), `${locale}:field.${field}`).not.toBe(`field.${field}`)
      }
    })
  }

  it('interpolates the changed-field list', () => {
    expect(tEmail('groupAutoRevert.changedFields', 'ua', { fields: 'назва, опис' }))
      .toBe('Змінені дані: назва, опис')
    expect(tEmail('groupAutoRevert.changedFields', 'en', { fields: 'title, description' }))
      .toBe('Changed details: title, description')
  })
})

describe('email subject interpolation', () => {
  it('substitutes the group title', () => {
    const subject = tEmail('subject.applicationReceived', 'ua', { groupTitle: 'Група підтримки' })

    expect(subject).toBe('Нова заявка на групу «Група підтримки»')
    expect(subject).not.toMatch(/\{\w+\}/)
  })

  it('substitutes the organizer name in English', () => {
    expect(tEmail('subject.organizerPendingReview', 'en', { organizerName: 'John Doe' }))
      .toBe('New profile pending verification — John Doe')
  })

  it('leaves an unresolved placeholder visible instead of dropping it', () => {
    expect(tEmail('subject.groupRejected', 'ua')).toContain('{groupTitle}')
  })

  it('interpolates numbers', () => {
    expect(tEmail('common.footer.rights', 'ua', { year: 2026 })).toContain('2026')
  })
})

describe('notification locale parity', () => {
  it('the DB-notification dictionaries expose the same keys', () => {
    expect(Object.keys(notificationUa).sort()).toEqual(Object.keys(notificationEn).sort())
  })

  it('includes the withdrawn-application key added for the email service', () => {
    for (const locale of locales) {
      const { subject, body } = t('application.withdrawn', locale, {
        applicantName: 'Іван',
        groupTitle: 'Група',
      })

      expect(subject).not.toBe('application.withdrawn')
      expect(body).toContain('Іван')
      expect(body).not.toMatch(/\{\w+\}/)
    }
  })
})
