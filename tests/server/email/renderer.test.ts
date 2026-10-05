import { describe, it, expect } from 'vitest'
import { tEmail } from '~~/server/i18n'
import type { Locale } from '~~/server/i18n'
import {
  button,
  escapeHtml,
  greeting,
  paragraph,
  reasonBlock,
  renderLayout,
} from '~~/server/services/email/renderer'
import type { RenderContext } from '~~/server/services/email/types'

const SITE_URL = 'https://psygroup.org'

function makeCtx(locale: Locale = 'ua'): RenderContext {
  return {
    locale,
    siteUrl: SITE_URL,
    t: (key, params) => tEmail(key, locale, params),
    absoluteUrl: path => `${SITE_URL}/${locale}${path === '/' ? '' : path}`,
  }
}

function layout(locale: Locale = 'ua', overrides: Partial<Parameters<typeof renderLayout>[0]> = {}) {
  return renderLayout({
    subject: 'Тестова тема',
    preheader: 'Прихований текст',
    bodyHtml: paragraph('Основний текст'),
    ctx: makeCtx(locale),
    ...overrides,
  })
}

describe('email renderer — base layout', () => {
  it('links the site name to the localized home URL', () => {
    const html = layout()

    expect(html).toContain(`href="${SITE_URL}/ua"`)
    expect(html).toContain('PsyGroup')
  })

  it('includes the preheader inside a hidden container', () => {
    const html = layout()

    expect(html).toContain('Прихований текст')
    expect(html).toMatch(/display:none[^>]*>Прихований текст/)
  })

  it('includes an unsubscribe link and the company address', () => {
    const html = layout()

    expect(html).toContain(`${SITE_URL}/ua/notifications`)
    expect(html).toContain('PsyGroup, Київ, Україна')
  })

  it('links privacy, terms and contacts pages in the footer', () => {
    const html = layout()

    expect(html).toContain(`${SITE_URL}/ua/privacy`)
    expect(html).toContain(`${SITE_URL}/ua/terms`)
    expect(html).toContain(`${SITE_URL}/ua/contacts`)
  })

  it('sets the html lang from the locale', () => {
    expect(layout('ua')).toContain('<html lang="uk">')
    expect(layout('en')).toContain('<html lang="en">')
  })

  it('renders English footer copy for the en locale', () => {
    const html = layout('en')

    expect(html).toContain('PsyGroup, Kyiv, Ukraine')
    expect(html).toContain(`${SITE_URL}/en/notifications`)
  })

  it('inlines every style — email clients drop <style> blocks', () => {
    const html = layout()

    expect(html).not.toContain('<style')
    expect(html).not.toContain('var(--')
  })

  it('escapes the subject, preheader and body', () => {
    const html = layout('ua', {
      subject: '<script>alert("x")</script>',
      preheader: 'a & b',
      bodyHtml: paragraph('<img src=x onerror=alert(1)>'),
    })

    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
    expect(html).toContain('a &amp; b')
    expect(html).not.toContain('<img src=x')
  })

  it('is a complete document', () => {
    const html = layout()

    expect(html.startsWith('<!doctype html>')).toBe(true)
    expect(html).toContain('<meta charset="utf-8">')
    expect(html.trimEnd().endsWith('</html>')).toBe(true)
  })
})

describe('email renderer — building blocks', () => {
  it('escapeHtml neutralizes markup and quotes', () => {
    expect(escapeHtml(`<a href="x">&'</a>`)).toBe(
      '&lt;a href=&quot;x&quot;&gt;&amp;&#39;&lt;/a&gt;',
    )
  })

  it('button renders an anchor with inline styles and the label', () => {
    const html = button('https://psygroup.org/ua/groups/x', 'Переглянути')

    expect(html).toContain('<a href="https://psygroup.org/ua/groups/x"')
    expect(html).toContain('Переглянути')
    expect(html).toContain('display:inline-block')
    expect(html).toContain('target="_blank"')
  })

  it('button refuses a javascript: URL', () => {
    expect(button('javascript:alert(1)', 'Click')).toContain('href="#"')
  })

  it('button escapes a hostile href', () => {
    expect(button('https://x.test/?a=1&b="2"', 'Go')).toContain('a=1&amp;b=&quot;2&quot;')
  })

  it('reasonBlock escapes moderator-authored text', () => {
    expect(reasonBlock('<b>не повна</b>')).toContain('&lt;b&gt;не повна&lt;/b&gt;')
  })

  it('greeting uses the name when present', () => {
    expect(greeting('Олена', makeCtx())).toContain('Вітаємо, Олена!')
  })

  it('greeting falls back to a generic salutation without a name', () => {
    const ctx = makeCtx()

    expect(greeting(undefined, ctx)).toContain('Вітаємо!')
    expect(greeting('   ', ctx)).toContain('Вітаємо!')
  })

  it('greeting escapes the recipient name', () => {
    expect(greeting('<script>', makeCtx())).toContain('&lt;script&gt;')
  })
})
