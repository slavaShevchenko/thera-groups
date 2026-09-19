import { describe, it, expect } from 'vitest'
import { t } from '../../server/i18n'

describe('server i18n — notification translations', () => {
  describe('t() returns subject and body', () => {
    it('returns Ukrainian translations by default', () => {
      const result = t('group.published', 'ua', { title: 'Тестова група' })
      expect(result.subject).toBe('Вашу групу опубліковано')
      expect(result.body).toContain('Тестова група')
    })

    it('returns English translations', () => {
      const result = t('group.published', 'en', { title: 'Test Group' })
      expect(result.subject).toBe('Your group has been published')
      expect(result.body).toContain('Test Group')
    })
  })

  describe('interpolation', () => {
    it('replaces all placeholders', () => {
      const result = t('group.rejected', 'ua', { title: 'Група', reason: 'Не повна інформація' })
      expect(result.body).toBe('Ваша група «Група» відхилена. Причина: Не повна інформація')
    })

    it('replaces placeholders in English', () => {
      const result = t('group.rejected', 'en', { title: 'Group', reason: 'Incomplete info' })
      expect(result.body).toBe('Your group "Group" has been rejected. Reason: Incomplete info')
    })

    it('leaves unresolved placeholders intact', () => {
      const result = t('group.rejected', 'ua', { title: 'Група' })
      expect(result.body).toContain('{reason}')
    })

    it('interpolates applicant name and group title', () => {
      const result = t('application.new', 'ua', { applicantName: 'Олексій', groupTitle: 'Група підтримки' })
      expect(result.subject).toBe('Нова заявка')
      expect(result.body).toBe('Олексій подав заявку на групу «Група підтримки»')
    })

    it('interpolates organizer name in verified notification', () => {
      const result = t('organizer.verified', 'en', { name: 'John Doe' })
      expect(result.subject).toBe('Profile verified')
      expect(result.body).toBe('Your profile "John Doe" has been verified')
    })

    it('interpolates name and reason in organizer rejected', () => {
      const result = t('organizer.rejected', 'ua', { name: 'Іван Петров', reason: 'Недостатній досвід' })
      expect(result.subject).toBe('Профіль відхилено')
      expect(result.body).toContain('Недостатній досвід')
    })
  })

  describe('all notification keys exist in both locales', () => {
    const keys = [
      'group.published',
      'group.rejected',
      'application.new',
      'application.approved',
      'application.rejected',
      'organizer.verified',
      'organizer.rejected',
      'admin.group.pending',
      'admin.organizer.pending',
    ]

    for (const key of keys) {
      it(`has "${key}" in Ukrainian`, () => {
        const result = t(key, 'ua')
        expect(result.subject).not.toBe(key)
        expect(result.body).not.toBe(key)
      })

      it(`has "${key}" in English`, () => {
        const result = t(key, 'en')
        expect(result.subject).not.toBe(key)
        expect(result.body).not.toBe(key)
      })
    }
  })

  describe('fallback for unknown keys', () => {
    it('returns the key itself for unknown translation keys', () => {
      const result = t('unknown.key', 'ua')
      expect(result.subject).toBe('unknown.key')
      expect(result.body).toBe('unknown.key')
    })
  })
})
