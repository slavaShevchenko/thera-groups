import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { renderTemplateEmail } from '~~/server/services/email'
import type { SendEmailOptions } from '~~/server/services/email'
import { emailRegistry } from '~~/server/services/email/registry'
import type { EmailTemplate } from '~~/server/services/email/types'
import type { Locale } from '~~/server/i18n'

const locales: Locale[] = ['ua', 'en']
const templates = Object.keys(emailRegistry) as EmailTemplate[]

// `satisfies` keeps the map complete in the editor; the assertion below enforces it at
// run time, because `tests/**` is not part of any generated tsconfig project.
const fixtures = {
  application_received: {
    recipientName: 'Олена Коваленко',
    applicantName: 'Іван Петренко',
    groupTitle: 'Група підтримки',
    groupSlug: 'support-group',
  },
  application_approved: {
    recipientName: 'Іван',
    groupTitle: 'Група підтримки',
    groupSlug: 'support-group',
  },
  application_rejected: {
    groupTitle: 'Група підтримки',
    groupSlug: 'support-group',
  },
  application_withdrawn: {
    recipientName: 'Олена',
    applicantName: 'Іван Петренко',
    groupTitle: 'Група підтримки',
    groupSlug: 'support-group',
  },
  group_published: {
    recipientName: 'Олена',
    groupTitle: 'Група підтримки',
    groupSlug: 'support-group',
  },
  group_rejected: {
    recipientName: 'Олена',
    groupTitle: 'Група підтримки',
    groupSlug: 'support-group',
    reason: 'Не вказано кваліфікацію ведучого',
  },
  group_pending_review: {
    recipientName: 'Адмін',
    groupTitle: 'Група підтримки',
  },
  organizer_pending_review: {
    recipientName: 'Адмін',
    organizerName: 'Іван Петренко',
  },
  organizer_verified: {
    recipientName: 'Іван',
    organizerName: 'Іван Петренко',
  },
  organizer_rejected: {
    recipientName: 'Іван',
    organizerName: 'Іван Петренко',
    reason: 'Недостатньо досвіду групової роботи',
  },
} satisfies Record<EmailTemplate, Record<string, string>>

const expectedCta: Record<EmailTemplate, string> = {
  application_received: 'https://psygroup.org/ua/groups/applications/support-group',
  application_approved: 'https://psygroup.org/ua/groups/support-group',
  application_rejected: 'https://psygroup.org/ua/catalog',
  application_withdrawn: 'https://psygroup.org/ua/groups/applications/support-group',
  group_published: 'https://psygroup.org/ua/groups/support-group',
  group_rejected: 'https://psygroup.org/ua/groups/edit/support-group',
  group_pending_review: 'https://psygroup.org/ua/admin',
  organizer_pending_review: 'https://psygroup.org/ua/admin',
  organizer_verified: 'https://psygroup.org/ua/groups/new',
  organizer_rejected: 'https://psygroup.org/ua/profile/edit',
}

function makeOptions(template: EmailTemplate, locale: Locale): SendEmailOptions {
  return {
    to: 'recipient@example.com',
    template,
    locale,
    data: fixtures[template],
  } as unknown as SendEmailOptions
}

let previousSiteUrl: string | undefined

beforeAll(() => {
  previousSiteUrl = process.env.SITE_URL
  process.env.SITE_URL = 'https://psygroup.org'
})

afterAll(() => {
  process.env.SITE_URL = previousSiteUrl
})

describe('email templates — every template renders in both locales', () => {
  it('has a fixture for every registered template', () => {
    expect(Object.keys(fixtures).sort()).toEqual([...templates].sort())
  })

  for (const template of templates) {
    for (const locale of locales) {
      it(`${template} [${locale}]`, () => {
        const { subject, html } = renderTemplateEmail(makeOptions(template, locale))

        expect(subject).not.toBe(emailRegistry[template].subjectKey)
        expect(html.startsWith('<!doctype html>')).toBe(true)
        expect(html).toContain(`https://psygroup.org/${locale}`)
        // No placeholder survived interpolation, and no raw key leaked into the body.
        expect(html).not.toMatch(/\{\w+\}/)
        expect(html).not.toContain('.preheader')
      })
    }
  }
})

describe('email templates — calls to action', () => {
  for (const template of templates) {
    it(`${template} links to ${expectedCta[template]}`, () => {
      const { html } = renderTemplateEmail(makeOptions(template, 'ua'))

      expect(html).toContain(`href="${expectedCta[template]}"`)
    })
  }

  it('localizes the CTA path', () => {
    const { html } = renderTemplateEmail(makeOptions('group_published', 'en'))

    expect(html).toContain('href="https://psygroup.org/en/groups/support-group"')
    expect(html).toContain('View the group')
  })
})

describe('email templates — content', () => {
  it('renders the rejection reason for a rejected group', () => {
    const { html } = renderTemplateEmail(makeOptions('group_rejected', 'ua'))

    expect(html).toContain('Причина: Не вказано кваліфікацію ведучого')
  })

  it('renders the rejection reason for a rejected organizer profile', () => {
    const { html } = renderTemplateEmail(makeOptions('organizer_rejected', 'en'))

    expect(html).toContain('Reason: Недостатньо досвіду групової роботи')
  })

  it('uses a generic greeting when the recipient name is unknown', () => {
    const { html } = renderTemplateEmail(makeOptions('application_rejected', 'ua'))

    expect(html).toContain('Вітаємо!')
  })

  it('greets the recipient by name when it is known', () => {
    const { html } = renderTemplateEmail(makeOptions('group_published', 'ua'))

    expect(html).toContain('Вітаємо, Олена!')
  })

  it('escapes free text coming from users and moderators', () => {
    const { html } = renderTemplateEmail({
      ...makeOptions('group_rejected', 'ua'),
      data: {
        groupTitle: '<script>alert("title")</script>',
        groupSlug: 'support-group',
        reason: '"><img src=x onerror=alert(1)>',
      },
    } as unknown as SendEmailOptions)

    expect(html).not.toContain('<script>')
    expect(html).not.toContain('<img src=x')
    expect(html).toContain('&lt;script&gt;')
  })

  it('does not leak the recipient email address into the body', () => {
    const { html } = renderTemplateEmail(makeOptions('application_approved', 'ua'))

    expect(html).not.toContain('recipient@example.com')
  })
})
