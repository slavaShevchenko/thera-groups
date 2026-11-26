import { describe, it, expect } from 'vitest'
import {
  parseMarkdown,
  markdownToText,
  truncateText,
  safeUrl,
  type MarkdownOptions,
} from '../../server/utils/markdown'
import type { MarkdownBlock, MarkdownInline } from '../../types'

function textOf(nodes: MarkdownInline[]): string {
  return nodes
    .map((node) => {
      if (node.type === 'text' || node.type === 'code') return node.text
      if (node.type === 'image') return node.alt
      if (node.type === 'br') return ' '
      return textOf(node.children)
    })
    .join('')
}

function firstBlock(source: string, options?: MarkdownOptions): MarkdownBlock {
  const blocks = parseMarkdown(source, options)
  expect(blocks.length).toBeGreaterThan(0)
  return blocks[0]!
}

describe('safeUrl', () => {
  it('accepts http, https and mailto', () => {
    expect(safeUrl('https://example.com/a')).toBe('https://example.com/a')
    expect(safeUrl('http://example.com')).toBe('http://example.com')
    expect(safeUrl('mailto:support@psygroup.org')).toBe('mailto:support@psygroup.org')
  })

  it('keeps a relative target relative', () => {
    expect(safeUrl('/ua/catalog')).toBe('/ua/catalog')
    expect(safeUrl('articles/next')).toBe('articles/next')
    expect(safeUrl('#section')).toBe('#section')
  })

  it('rejects scriptable and data schemes', () => {
    expect(safeUrl('javascript:alert(1)')).toBeNull()
    expect(safeUrl('JaVaScRiPt:alert(1)')).toBeNull()
    expect(safeUrl('data:text/html,<script>alert(1)</script>')).toBeNull()
    expect(safeUrl('vbscript:msgbox(1)')).toBeNull()
  })

  it('rejects a scheme hidden behind control characters', () => {
    // A URL parser strips these, so deciding on the raw string is what catches them.
    expect(safeUrl('java\tscript:alert(1)')).toBeNull()
    expect(safeUrl('javascript\u0000:alert(1)')).toBeNull()
  })

  it('rejects a protocol-relative target and an unparsable one', () => {
    expect(safeUrl('//evil.example.com/x')).toBeNull()
    expect(safeUrl('http://')).toBeNull()
  })

  it('rejects empty and over-long values', () => {
    expect(safeUrl('')).toBeNull()
    expect(safeUrl(null)).toBeNull()
    expect(safeUrl(undefined)).toBeNull()
    expect(safeUrl(`https://example.com/${'a'.repeat(2100)}`)).toBeNull()
  })
})

describe('parseMarkdown blocks', () => {
  it('maps paragraphs and inline formatting', () => {
    const block = firstBlock('Звичайний **жирний** та *курсив* текст.')

    expect(block.type).toBe('paragraph')
    expect(block.type === 'paragraph' && block.children.map(n => n.type))
      .toEqual(['text', 'strong', 'text', 'em', 'text'])
  })

  it('shifts headings down one level so the page keeps a single h1', () => {
    expect(firstBlock('# Заголовок')).toMatchObject({ type: 'heading', level: 2 })
    expect(firstBlock('## Заголовок')).toMatchObject({ type: 'heading', level: 3 })
    expect(firstBlock('###### Заголовок')).toMatchObject({ type: 'heading', level: 6 })
  })

  it('clamps a heading that is already at the deepest level', () => {
    // `#######` is not a heading in markdown, so the deepest reachable input is six hashes.
    expect(firstBlock('###### Глибоко')).toMatchObject({ level: 6 })
  })

  it('parses ordered and unordered lists, keeping the start number', () => {
    const unordered = firstBlock('- один\n- два')
    expect(unordered).toMatchObject({ type: 'list', ordered: false, start: 1 })

    const ordered = firstBlock('3. третій\n4. четвертий')
    expect(ordered).toMatchObject({ type: 'list', ordered: true, start: 3 })
    expect(ordered.type === 'list' && ordered.items).toHaveLength(2)
  })

  it('nests a list inside a list item', () => {
    const list = firstBlock('- верхній\n  - вкладений')
    expect(list.type).toBe('list')
    if (list.type !== 'list') return

    const nested = list.items[0]!.find(block => block.type === 'list')
    expect(nested).toBeDefined()
  })

  it('keeps a blockquote as blocks, not as text', () => {
    const block = firstBlock('> Цитата з **наголосом**.')
    expect(block.type).toBe('blockquote')
    expect(block.type === 'blockquote' && block.children[0]?.type).toBe('paragraph')
  })

  it('keeps a fenced code block verbatim, with its language', () => {
    const block = firstBlock('```js\nconst a = 1\n```')
    expect(block).toMatchObject({ type: 'code', lang: 'js', text: 'const a = 1' })
  })

  it('maps a horizontal rule', () => {
    expect(firstBlock('---\n\nТекст')).toMatchObject({ type: 'hr' })
  })
})

/**
 * Both options exist because a markdown body never renders alone, and because not every
 * author was writing markdown: an article is an admin document sitting under the page's only
 * `h1`, while a group's description and program are textarea text sitting under the `h2`
 * heading that introduces the section.
 */
describe('parseMarkdown options', () => {
  it('shifts a body two levels down when the page already used h2 around it', () => {
    expect(firstBlock('# Розділ', { headingOffset: 2 })).toMatchObject({ type: 'heading', level: 3 })
    expect(firstBlock('## Підрозділ', { headingOffset: 2 })).toMatchObject({ type: 'heading', level: 4 })
  })

  it('clamps at h6 whatever the offset, rather than falling off the level union', () => {
    expect(firstBlock('###### Глибоко', { headingOffset: 2 })).toMatchObject({ level: 6 })
  })

  it('carries the offset into a heading nested in a blockquote or a list item', () => {
    const quote = firstBlock('> # Цитований розділ', { headingOffset: 2 })
    expect(quote.type === 'blockquote' && quote.children[0]).toMatchObject({ type: 'heading', level: 3 })

    const list = firstBlock('- # Розділ у пункті', { headingOffset: 2 })
    expect(list.type === 'list' && list.items[0]![0]).toMatchObject({ type: 'heading', level: 3 })
  })

  it('keeps a single newline as a line break when asked', () => {
    const block = firstBlock('Перший рядок\nДругий рядок', { breaks: true })

    expect(block.type === 'paragraph' && block.children.map(node => node.type))
      .toEqual(['text', 'br', 'text'])
  })

  it('leaves a single newline a soft wrap by default, which is what markdown means', () => {
    const block = firstBlock('Перший рядок\nДругий рядок')

    expect(block.type === 'paragraph' && block.children.map(node => node.type)).toEqual(['text'])
  })
})

describe('parseMarkdown safety', () => {
  it('drops a raw HTML block instead of rendering it', () => {
    const blocks = parseMarkdown('<script>alert(1)</script>\n\nБезпечний абзац.')

    expect(blocks).toHaveLength(1)
    expect(blocks[0]).toMatchObject({ type: 'paragraph' })
    expect(blocks[0]!.type === 'paragraph' && textOf(blocks[0]!.children))
      .toBe('Безпечний абзац.')
  })

  it('drops an inline HTML tag but keeps the surrounding words', () => {
    const block = firstBlock('Перед <img src=x onerror=alert(1)> після')
    expect(block.type === 'paragraph' && textOf(block.children)).toBe('Перед  після')
  })

  it('renders a javascript: link as its own label', () => {
    const block = firstBlock('[клікни](javascript:alert(1))')

    expect(block.type === 'paragraph' && block.children.map(n => n.type)).toEqual(['text'])
    expect(block.type === 'paragraph' && textOf(block.children)).toBe('клікни')
  })

  it('keeps a safe link as a link node', () => {
    const block = firstBlock('[Каталог](/ua/catalog "Події")')

    expect(block.type).toBe('paragraph')
    if (block.type !== 'paragraph') return
    expect(block.children[0]).toMatchObject({
      type: 'link',
      href: '/ua/catalog',
      title: 'Події',
    })
  })

  it('renders an image with an unusable source as its alt text', () => {
    const block = firstBlock('![Схема групи](javascript:alert(1))')
    expect(block.type === 'paragraph' && textOf(block.children)).toBe('Схема групи')
  })

  it('keeps an image with a safe source', () => {
    const block = firstBlock('![Схема](/images/schema.png)')
    expect(block.type === 'paragraph' && block.children[0]).toMatchObject({
      type: 'image',
      src: '/images/schema.png',
      alt: 'Схема',
    })
  })

  it('produces no nodes at all from HTML-only input', () => {
    expect(parseMarkdown('<div><b>тільки теги</b></div>')).toEqual([])
  })

  it('drops a table, which the admin form states is unsupported', () => {
    const source = '| a | b |\n| - | - |\n| 1 | 2 |\n\nПісля таблиці.'
    const blocks = parseMarkdown(source)

    expect(blocks).toHaveLength(1)
    expect(blocks[0]!.type === 'paragraph' && textOf(blocks[0]!.children)).toBe('Після таблиці.')
  })
})

describe('parseMarkdown edges', () => {
  it('returns an empty array for blank input', () => {
    expect(parseMarkdown('')).toEqual([])
    expect(parseMarkdown('   \n\n  ')).toEqual([])
    expect(parseMarkdown(null)).toEqual([])
    expect(parseMarkdown(undefined)).toEqual([])
  })
})

describe('markdownToText', () => {
  it('flattens structure into prose', () => {
    const text = markdownToText(parseMarkdown('# Заголовок\n\nАбзац **один**.\n\n- пункт\n- ще пункт'))

    expect(text).toBe('Заголовок Абзац один. пункт ще пункт')
  })

  it('uses an image alt text as words', () => {
    expect(markdownToText(parseMarkdown('![Схема групи](/images/a.png)'))).toBe('Схема групи')
  })

  it('returns an empty string for an empty document', () => {
    expect(markdownToText(parseMarkdown(''))).toBe('')
  })
})

describe('truncateText', () => {
  it('leaves a short text alone', () => {
    expect(truncateText('Короткий текст', 100)).toBe('Короткий текст')
  })

  it('cuts on a word boundary and adds an ellipsis', () => {
    expect(truncateText(' one two three four five six', 14)).toBe('one two three…')
  })

  it('never returns more than the budget', () => {
    const long = 'слово '.repeat(200).trim()
    expect(truncateText(long, 320).length).toBeLessThanOrEqual(321)
  })

  it('cuts a single long token rather than returning it whole', () => {
    expect(truncateText('a'.repeat(50), 10)).toBe('aaaaaaaaaa…')
  })

  it('drops the punctuation a cut landed on', () => {
    expect(truncateText('Перше речення. Друге речення тут.', 20)).toBe('Перше речення…')
  })
})
