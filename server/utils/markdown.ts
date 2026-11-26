import { marked, type Token, type Tokens } from 'marked'
import type { MarkdownBlock, MarkdownHeadingLevel, MarkdownInline } from '~~/types'

/**
 * Markdown → a closed set of typed nodes, and never → HTML.
 *
 * An article body is written by an admin and a group's description and program by a verified
 * organizer; every one of them is read by every anonymous visitor. So the tempting
 * implementation — `marked.parse()` into a `v-html` — puts a sanitizer on the critical path
 * of the inputs on this site that are both free-form and rendered to strangers. This module
 * removes the step instead of implementing it: `marked.lexer()` tokenizes, the token tree is
 * mapped onto `MarkdownBlock`/`MarkdownInline`, and `MarkdownContent.vue` renders those nodes
 * with real elements and `{{ }}` interpolation. There is no HTML string anywhere on the path,
 * so there is nothing to sanitize, and a construct that is not in the node set cannot reach
 * the browser at all.
 *
 * Two things are therefore dropped rather than rendered, both documented in the forms that
 * accept markdown: raw HTML blocks and inline tags (`Tokens.HTML`), and tables. Dropping is
 * the safe default here — rendering either would need the very sanitizer this design avoids.
 */

/** Deepest heading both HTML and `MarkdownHeadingLevel` allow. */
const MAX_HEADING_LEVEL = 6

/**
 * The two things only the caller knows about a markdown body: which heading levels the page
 * around it already used, and whether its author was writing markdown or plain text.
 */
export interface MarkdownOptions {
  /**
   * Levels every heading in the body moves down, so it cannot compete with the heading the
   * page renders around it. `1` puts `#` at `h2` — an article, whose only `h1` is its title.
   * `2` puts `#` at `h3` — a group's description or program, which the page introduces with
   * an `h2` section heading of its own. Depth clamps at `h6` rather than wrapping.
   */
  headingOffset?: number
  /**
   * A single newline becomes a `<br>` instead of joining two lines into one paragraph.
   *
   * Off by default, because that is markdown: a soft wrap stays soft and a paragraph needs a
   * blank line. On for text that was written in a plain textarea and displayed with
   * `white-space: pre-wrap` before it was parsed at all — parsing it as markdown without
   * this would reflow every description already published into one unbroken paragraph.
   */
  breaks?: boolean
}

/**
 * How a body reads when the caller asks for nothing in particular: an article page, whose
 * only `h1` is the title and whose author wrote markdown in a markdown editor.
 */
const DEFAULT_OPTIONS: Required<MarkdownOptions> = { headingOffset: 1, breaks: false }

/** Longest URL accepted. A link past this is a payload, not a destination. */
const MAX_URL_LENGTH = 2000

const SAFE_URL_PROTOCOLS = new Set(['http:', 'https:', 'mailto:'])

/**
 * A URL this renderer will put into an `href` or a `src`, or null.
 *
 * Checked here rather than in the component because the component receives a plain string
 * with no memory of where it came from, and a second call site would eventually forget.
 *
 * Relative and root-relative targets are allowed as-is: they resolve against our own origin
 * and cannot name a scheme. A protocol-relative `//host` is refused even though it would
 * parse as `http:` — it is an off-site link wearing the shape of a local one. Everything
 * else has to survive `new URL()` and land on an allowlisted protocol, which is what turns
 * away `javascript:`, `data:` and `vbscript:`. Control characters and spaces are rejected
 * before parsing because a URL parser strips them, and the string we decide on has to be the
 * string the browser acts on.
 */
export function safeUrl(raw: string | null | undefined): string | null {
  const value = (raw ?? '').trim()

  if (!value || value.length > MAX_URL_LENGTH) return null
  // Matching control characters is the whole point of this line, so `no-control-regex` is
  // disabled for it: a URL parser strips `\n` and `\t` before it decides on a protocol, and
  // the string this function allows has to be the string the browser later acts on. Without
  // the check, "java\nscript:alert(1)" would reach an `href`.
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u0020\u007F]/.test(value)) return null

  if (value.startsWith('/')) {
    return value.startsWith('//') ? null : value
  }
  if (value.startsWith('#') || value.startsWith('?')) return value

  try {
    // The base only exists so a relative reference parses; the original string is what is
    // returned, so a relative link stays relative.
    const parsed = new URL(value, 'https://base.invalid/')
    if (!SAFE_URL_PROTOCOLS.has(parsed.protocol)) return null
  }
  catch {
    return null
  }

  return value
}

function inlineText(token: Token): string {
  return (token as { text?: string }).text ?? ''
}

function childTokens(token: Token): Token[] {
  return (token as { tokens?: Token[] }).tokens ?? []
}

/**
 * Maps `marked`'s inline tokens onto `MarkdownInline`.
 *
 * A `text` token can carry its own inline children — that is how a tight list item arrives,
 * as one `text` wrapping the formatting inside it — so the children win when present and the
 * raw string is only the fallback.
 */
function mapInline(tokens: Token[]): MarkdownInline[] {
  const out: MarkdownInline[] = []

  for (const token of tokens) {
    switch (token.type) {
      case 'strong':
      case 'em':
      case 'del': {
        const children = mapInline(childTokens(token))
        if (children.length > 0) {
          out.push({ type: token.type, children })
        }
        break
      }

      case 'codespan':
        out.push({ type: 'code', text: (token as Tokens.Codespan).text })
        break

      case 'br':
        out.push({ type: 'br' })
        break

      case 'link': {
        const link = token as Tokens.Link
        const href = safeUrl(link.href)
        // The link's own inline children, or its raw label when there are none. Typed as a
        // node list so both arms of every use below agree on the shape.
        const label: MarkdownInline[] = mapInline(childTokens(link))
        const children: MarkdownInline[] = label.length > 0
          ? label
          : [{ type: 'text', text: link.text }]

        // An unusable destination degrades to its own label: the words stay readable and
        // nothing clickable is produced, which beats both a dead link and a dropped sentence.
        if (href === null) {
          out.push(...children)
          break
        }
        out.push({
          type: 'link',
          href,
          title: link.title?.trim() ? link.title.trim() : null,
          children,
        })
        break
      }

      case 'image': {
        const image = token as Tokens.Image
        const src = safeUrl(image.href)
        // Unlike a link, an image with no usable source renders as its alt text: a broken
        // <img> is a hole in the layout, and the alt text is what was meant to be there.
        if (src === null) {
          if (image.text) out.push({ type: 'text', text: image.text })
          break
        }
        out.push({
          type: 'image',
          src,
          alt: image.text ?? '',
          title: image.title?.trim() ? image.title.trim() : null,
        })
        break
      }

      case 'text': {
        const nested = childTokens(token)
        if (nested.length > 0) {
          out.push(...mapInline(nested))
        }
        else {
          const text = inlineText(token)
          if (text) out.push({ type: 'text', text })
        }
        break
      }

      case 'escape':
        if (inlineText(token)) out.push({ type: 'text', text: inlineText(token) })
        break

      default:
        // An inline construct with no node of its own — `html` inside a paragraph, say.
        // Its text is kept so a sentence does not lose a word, and no markup is produced.
        break
    }
  }

  return out
}

/**
 * Maps `marked`'s block tokens onto `MarkdownBlock`.
 *
 * Heading depth is shifted by `headingOffset` so a body starts below whatever heading the
 * page around it already rendered: an article title is the page's only `h1`, and a second
 * `h1` is both a structured-data warning and a screen reader that announces the title twice.
 */
function mapBlocks(tokens: Token[], headingOffset: number): MarkdownBlock[] {
  const out: MarkdownBlock[] = []

  for (const token of tokens) {
    switch (token.type) {
      case 'heading': {
        const heading = token as Tokens.Heading
        const level = Math.min(
          heading.depth + headingOffset,
          MAX_HEADING_LEVEL,
        ) as MarkdownHeadingLevel
        const children = mapInline(childTokens(heading))
        if (children.length > 0) out.push({ type: 'heading', level, children })
        break
      }

      case 'paragraph': {
        const children = mapInline(childTokens(token))
        if (children.length > 0) out.push({ type: 'paragraph', children })
        break
      }

      case 'blockquote': {
        const children = mapBlocks(childTokens(token), headingOffset)
        if (children.length > 0) out.push({ type: 'blockquote', children })
        break
      }

      case 'code': {
        const code = token as Tokens.Code
        const lang = code.lang?.trim()
        out.push({ type: 'code', text: code.text, lang: lang ? lang : null })
        break
      }

      case 'list': {
        const list = token as Tokens.List
        // `start` is `""` on an unordered list and on an ordered one written without a
        // number; both mean "start at 1", and `0` would be a list that begins at zero.
        const start = typeof list.start === 'number' && list.start > 0 ? list.start : 1
        const items = list.items
          .map(item => mapBlocks(childTokens(item), headingOffset))
          .filter(item => item.length > 0)
        if (items.length > 0) {
          out.push({ type: 'list', ordered: list.ordered, start, items })
        }
        break
      }

      case 'hr':
        out.push({ type: 'hr' })
        break

      case 'text': {
        // A block-level `text` token is what a tight list item's content arrives as, and
        // what the top level produces for a line that is not otherwise a construct. Either
        // way it is a paragraph, and its inline children carry the formatting.
        const nested = childTokens(token)
        const children = nested.length > 0 ? mapInline(nested) : []
        if (children.length > 0) {
          out.push({ type: 'paragraph', children })
        }
        else if (inlineText(token).trim()) {
          out.push({ type: 'paragraph', children: [{ type: 'text', text: inlineText(token).trim() }] })
        }
        break
      }

      default:
        // `space`, `html`, `table`, `def`: nothing to render. Raw HTML and tables are the
        // two constructs an admin might expect, and the form says they are not supported.
        break
    }
  }

  return out
}

/**
 * Parses markdown source into renderable nodes.
 *
 * `marked.lexer()` is a pure tokenizer — it never emits HTML — and the whole result is
 * rebuilt node by node, so an unknown or future token type is dropped rather than passed on.
 */
export function parseMarkdown(
  source: string | null | undefined,
  options: MarkdownOptions = {},
): MarkdownBlock[] {
  const text = source ?? ''
  if (!text.trim()) return []

  const { headingOffset, breaks } = { ...DEFAULT_OPTIONS, ...options }

  return mapBlocks(marked.lexer(text, { gfm: true, breaks, async: false }), headingOffset)
}

function inlineToText(nodes: MarkdownInline[]): string {
  let out = ''

  for (const node of nodes) {
    switch (node.type) {
      case 'text':
      case 'code':
        out += node.text
        break
      case 'strong':
      case 'em':
      case 'del':
      case 'link':
        out += inlineToText(node.children)
        break
      case 'image':
        out += node.alt
        break
      case 'br':
        out += ' '
        break
    }
  }

  return out
}

function blocksToText(nodes: MarkdownBlock[], out: string[]): void {
  for (const node of nodes) {
    switch (node.type) {
      case 'heading':
      case 'paragraph':
        out.push(inlineToText(node.children))
        break
      case 'blockquote':
        blocksToText(node.children, out)
        break
      case 'list':
        for (const item of node.items) blocksToText(item, out)
        break
      case 'code':
        out.push(node.text)
        break
      case 'hr':
        break
    }
  }
}

/**
 * The article body as prose, for the two places that need words rather than structure: the
 * list card's excerpt and the meta description. Whitespace is normalized because the source
 * carries newlines and indentation that mean nothing once the markup is gone.
 */
export function markdownToText(blocks: MarkdownBlock[]): string {
  const parts: string[] = []
  blocksToText(blocks, parts)
  return parts.join(' ').replace(/\s+/g, ' ').trim()
}

/**
 * Cuts prose to at most `max` characters, on a word boundary, with an ellipsis.
 *
 * Backing off to the last space is what keeps a card from ending in the middle of a word;
 * a text with no space at all in range is cut anyway, because the alternative is returning
 * the whole thing and blowing the budget the caller asked for.
 */
export function truncateText(text: string, max: number): string {
  const value = text.trim()
  if (value.length <= max) return value

  const cut = value.slice(0, max)
  const lastSpace = cut.lastIndexOf(' ')

  return `${(lastSpace > 0 ? cut.slice(0, lastSpace) : cut).replace(/[,;:.\s]+$/, '')}…`
}
