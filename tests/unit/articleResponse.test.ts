import { describe, it, expect } from 'vitest'
import {
  mapAdminArticleForm,
  mapAdminArticleListItem,
  mapArticleForPublic,
  mapArticleListItem,
  mapArticleTeaser,
} from '../../server/utils/articleResponse'
import { startOfSiteDay } from '../../server/utils/siteTime'
import { ARTICLE_LIMITS } from '../../shared/constants/limits'

/**
 * A public list row as `articleRepository.findPublished` returns it, including the author
 * fields that decide the byline and must then be dropped rather than published.
 */
function makePublicRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'cuid-article',
    slug: 'yak-obraty-hrupu',
    status: 'PUBLISHED',
    authorId: 'cuid-profile',
    authorName: null,
    publishedAt: startOfSiteDay('2026-11-19'),
    createdAt: new Date('2026-11-01T10:00:00.000Z'),
    updatedAt: new Date('2026-11-19T09:12:00.000Z'),
    author: {
      firstName: 'Олена',
      lastName: 'Коваль',
      slug: 'olena-koval',
      verificationStatus: 'VERIFIED',
      user: { isActive: true },
    },
    translations: [{ title: '  Як обрати групу  ', content: '## Орієнтири\n\nТекст статті.' }],
    ...overrides,
  }
}

/**
 * A headline row as `articleRepository.findLatestHeadlines` returns it: the fields the home
 * page's discovery block renders, and no `content` or `author` for it to leak.
 */
function makeHeadlineRow(overrides: Record<string, unknown> = {}) {
  return {
    slug: 'yak-obraty-hrupu',
    publishedAt: startOfSiteDay('2026-11-19'),
    updatedAt: new Date('2026-11-19T09:12:00.000Z'),
    translations: [{ title: '  Як обрати групу  ' }],
    ...overrides,
  }
}

/** An admin list row: titles only, because the list never renders a body. */
function makeAdminListRow(overrides: Record<string, unknown> = {}) {
  return {
    slug: 'yak-obraty-hrupu',
    status: 'PUBLISHED',
    authorId: null,
    authorName: null,
    publishedAt: startOfSiteDay('2026-11-19'),
    updatedAt: new Date('2026-11-19T09:12:00.000Z'),
    author: { firstName: 'Олена', lastName: 'Коваль' },
    translations: [
      { locale: 'en', title: 'How to choose a group' },
      { locale: 'ua', title: 'Як обрати групу' },
    ],
    ...overrides,
  }
}

/** An admin edit row: both translations in full, markdown source and all. */
function makeAdminRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'cuid-article',
    slug: 'yak-obraty-hrupu',
    status: 'DRAFT',
    authorId: 'cuid-profile',
    authorName: null,
    publishedAt: startOfSiteDay('2026-11-19'),
    createdAt: new Date('2026-11-01T10:00:00.000Z'),
    updatedAt: new Date('2026-11-19T09:12:00.000Z'),
    author: {
      firstName: 'Олена',
      lastName: 'Коваль',
      slug: 'olena-koval',
      verificationStatus: 'VERIFIED',
      user: { isActive: true },
    },
    translations: [
      { locale: 'ua', title: 'Як обрати групу', content: '## Орієнтири' },
      { locale: 'en', title: 'How to choose a group', content: '## Landmarks' },
    ],
    ...overrides,
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- the mappers read a Prisma row shape
const listItem = (overrides: Record<string, unknown> = {}) => mapArticleListItem(makePublicRow(overrides) as any)
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- the mappers read a Prisma row shape
const teaser = (overrides: Record<string, unknown> = {}) => mapArticleTeaser(makeHeadlineRow(overrides) as any)
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- the mappers read a Prisma row shape
const publicArticle = (overrides: Record<string, unknown> = {}) => mapArticleForPublic(makePublicRow(overrides) as any, 'ua')
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- the mappers read a Prisma row shape
const adminListItem = (overrides: Record<string, unknown> = {}) => mapAdminArticleListItem(makeAdminListRow(overrides) as any)
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- the mappers read a Prisma row shape
const adminForm = (overrides: Record<string, unknown> = {}) => mapAdminArticleForm(makeAdminRow(overrides) as any)

describe('mapArticleListItem', () => {
  it('identifies the article by its slug and never emits the cuid', () => {
    const mapped = listItem()

    expect(mapped.slug).toBe('yak-obraty-hrupu')
    expect(JSON.stringify(mapped)).not.toContain('cuid')
  })

  it('trims the title, and falls back to the slug when there is none', () => {
    expect(listItem().title).toBe('Як обрати групу')

    const untitled = listItem({ translations: [{ title: '   ', content: 'Текст' }] })
    expect(untitled.title).toBe('yak-obraty-hrupu')
  })

  /**
   * `siteDayString()` reads the day back in the same zone `startOfSiteDay()` wrote it in, so
   * the two are exact inverses and the day an editor chose is the day the card prints —
   * whatever zone the visitor's browser is in.
   */
  it('carries a bare day, not the stored instant', () => {
    const mapped = listItem()

    expect(mapped.publishedDate).toBe('2026-11-19')
    expect(mapped.publishedDate).not.toContain('T')
  })

  it('cuts the excerpt from the body as prose, with no markdown left in it', () => {
    const mapped = listItem({
      translations: [{ title: 'Назва', content: '## Заголовок\n\n**Жирний** текст і [посилання](https://example.com).' }],
    })

    expect(mapped.excerpt).not.toContain('#')
    expect(mapped.excerpt).not.toContain('**')
    expect(mapped.excerpt).not.toContain('https://')
    expect(mapped.excerpt).toContain('Жирний текст і посилання')
  })

  it('cuts a long body to the card budget with an ellipsis', () => {
    const mapped = listItem({
      translations: [{ title: 'Назва', content: 'слово '.repeat(500) }],
    })

    expect(mapped.excerpt.length).toBeLessThanOrEqual(ARTICLE_LIMITS.EXCERPT_MAX + 1)
    expect(mapped.excerpt.endsWith('…')).toBe(true)
  })

  it('leaves a short body uncut', () => {
    expect(listItem().excerpt).toBe('Орієнтири Текст статті.')
  })

  describe('the byline', () => {
    it('links a linked organizer whose profile is publicly reachable', () => {
      expect(listItem().author).toEqual({ name: 'Олена Коваль', slug: 'olena-koval' })
    })

    /**
     * `organizer.profile.view` refuses an unverified profile and refuses a deactivated
     * account, so a slug in either case would be a link to a 404. The name still shows: an
     * article does not stop having been written by somebody because their profile moved.
     */
    it('names an organizer whose profile is not reachable and withholds the slug', () => {
      const pending = makePublicRow()
      expect(listItem({
        author: { ...pending.author, verificationStatus: 'PENDING' },
      }).author).toEqual({ name: 'Олена Коваль', slug: null })

      expect(listItem({
        author: { ...pending.author, user: { isActive: false } },
      }).author).toEqual({ name: 'Олена Коваль', slug: null })
    })

    it('uses the free-text name when there is no linked organizer', () => {
      expect(listItem({ author: null, authorName: '  Запрошений автор  ' }).author)
        .toEqual({ name: 'Запрошений автор', slug: null })
    })

    it('prefers the linked organizer over a free-text name left on the row', () => {
      expect(listItem({ authorName: 'Старе імʼя' }).author)
        .toEqual({ name: 'Олена Коваль', slug: 'olena-koval' })
    })

    it('has no author when the row has neither source', () => {
      expect(listItem({ author: null, authorName: null }).author).toBeNull()
      expect(listItem({ author: null, authorName: '   ' }).author).toBeNull()
    })

    it('treats a linked profile with no name as no author at all', () => {
      expect(listItem({
        author: { firstName: '', lastName: '', slug: 'olena-koval', verificationStatus: 'VERIFIED', user: { isActive: true } },
      }).author).toBeNull()
    })

    /**
     * `verificationStatus` and `user.isActive` are read to decide whether the slug may be
     * published, and then dropped — an anonymous caller has no use for either, and the shape
     * of a public payload is what says so.
     */
    it('drops the fields it read to decide the byline', () => {
      const mapped = JSON.parse(JSON.stringify(listItem()))

      expect(mapped.author).not.toHaveProperty('verificationStatus')
      expect(mapped.author).not.toHaveProperty('user')
      expect(mapped.author).not.toHaveProperty('avatarUrl')
      expect(JSON.stringify(mapped)).not.toContain('VERIFIED')
    })
  })
})

describe('mapArticleTeaser', () => {
  it('carries the slug, the trimmed title and the bare publication day', () => {
    expect(teaser()).toEqual({
      slug: 'yak-obraty-hrupu',
      title: 'Як обрати групу',
      publishedDate: '2026-11-19',
    })
  })

  it('falls back to the slug for a title that is only whitespace', () => {
    expect(teaser({ translations: [{ title: '   ' }] }).title).toBe('yak-obraty-hrupu')
  })

  /**
   * The whole point of a separate read: the home page renders a date and a linked title, so
   * the payload is those two fields plus the slug that builds the link. An excerpt or a
   * byline here would be a field the block cannot show and a body the query never selected.
   */
  it('carries nothing beyond the slug, the title and the day', () => {
    expect(Object.keys(teaser()).sort()).toEqual(['publishedDate', 'slug', 'title'])

    const serialized = JSON.stringify(teaser())
    expect(serialized).not.toContain('excerpt')
    expect(serialized).not.toContain('author')
    expect(serialized).not.toContain('content')
  })

  it('falls back to updatedAt for a row that has no publication day', () => {
    expect(teaser({ publishedAt: null }).publishedDate).toBe('2026-11-19')
  })
})

describe('mapArticleForPublic', () => {
  it('sends the body as parsed nodes rather than as markdown or HTML', () => {
    const mapped = publicArticle()

    expect(mapped.content).toEqual([
      { type: 'heading', level: 3, children: [{ type: 'text', text: 'Орієнтири' }] },
      { type: 'paragraph', children: [{ type: 'text', text: 'Текст статті.' }] },
    ])
  })

  /**
   * The client carries no markdown parser and nothing on this path uses `v-html`, so a
   * construct outside the node set cannot reach a browser at all — raw HTML included.
   */
  it('drops a raw HTML block instead of passing it through', () => {
    const mapped = publicArticle({
      translations: [{ title: 'Назва', content: 'Текст\n\n<script>alert(1)</script>\n\n<img src=x onerror=alert(1)>' }],
    })

    const serialized = JSON.stringify(mapped.content)
    expect(serialized).not.toContain('<script>')
    expect(serialized).not.toContain('onerror')
    expect(serialized).toContain('Текст')
  })

  it('refuses a link whose destination is not a real one', () => {
    const mapped = publicArticle({
      translations: [{ title: 'Назва', content: '[клікни](javascript:alert(1))' }],
    })

    expect(JSON.stringify(mapped.content)).not.toContain('javascript:')
  })

  it('echoes the locale the page asked for', () => {
    expect(publicArticle().locale).toBe('ua')
  })

  /**
   * Two cuts of one body with different budgets, both from the same parse. A meta
   * description longer than the snippet would have Google quote text no visitor ever saw on
   * the page that ranked for it.
   */
  it('derives the excerpt and the meta description from the same text', () => {
    const long = 'слово '.repeat(500)
    const mapped = publicArticle({ translations: [{ title: 'Назва', content: long }] })

    expect(mapped.metaDescription.length).toBeLessThanOrEqual(ARTICLE_LIMITS.META_DESCRIPTION_MAX + 1)
    expect(mapped.excerpt.length).toBeGreaterThan(mapped.metaDescription.length)
    expect(mapped.excerpt.startsWith(mapped.metaDescription.slice(0, 40))).toBe(true)
  })

  it('carries updatedAt as an instant, the one field on this payload that is', () => {
    expect(publicArticle().updatedAt).toBe('2026-11-19T09:12:00.000Z')
  })

  it('omits the cuid, the stored markdown and the admin-only columns', () => {
    const serialized = JSON.stringify(publicArticle())

    expect(serialized).not.toContain('cuid')
    expect(serialized).not.toContain('authorId')
    expect(serialized).not.toContain('createdById')
    expect(serialized).not.toContain('## Орієнтири')
  })
})

describe('mapAdminArticleListItem', () => {
  it('titles the row from the Ukrainian translation first', () => {
    expect(adminListItem().title).toBe('Як обрати групу')
  })

  it('falls back to the English title, then to the slug', () => {
    expect(adminListItem({
      translations: [{ locale: 'en', title: 'How to choose a group' }],
    }).title).toBe('How to choose a group')

    expect(adminListItem({
      translations: [{ locale: 'en', title: '   ' }],
    }).title).toBe('yak-obraty-hrupu')
  })

  /**
   * This is how the list shows why a publish was refused without pulling either body off the
   * database: the set of locales that exist, in a fixed order.
   */
  it('lists the locales that exist, Ukrainian first whatever order they arrive in', () => {
    expect(adminListItem().locales).toEqual(['ua', 'en'])
    expect(adminListItem({ translations: [{ locale: 'en', title: 'Title' }] }).locales).toEqual(['en'])
    expect(adminListItem({ translations: [] }).locales).toEqual([])
  })

  it('has no publication day until one is chosen', () => {
    expect(adminListItem({ publishedAt: null }).publishedDate).toBeNull()
    expect(adminListItem().publishedDate).toBe('2026-11-19')
  })

  it('credits the linked organizer, then the free-text name, then nobody', () => {
    expect(adminListItem().authorName).toBe('Олена Коваль')
    expect(adminListItem({ author: null, authorName: 'Запрошений автор' }).authorName).toBe('Запрошений автор')
    expect(adminListItem({ author: null, authorName: null }).authorName).toBeNull()
  })

  it('carries updatedAt as an instant, for the "newest edited first" the list is sorted by', () => {
    expect(adminListItem().updatedAt).toBe('2026-11-19T09:12:00.000Z')
  })
})

describe('mapAdminArticleForm', () => {
  /**
   * The form edits markdown source, so what is stored is what comes back — a rendered body
   * would not round-trip, and every save would slowly eat the markup.
   */
  it('round-trips both locales as markdown source', () => {
    expect(adminForm().translations).toEqual({
      ua: { title: 'Як обрати групу', content: '## Орієнтири' },
      en: { title: 'How to choose a group', content: '## Landmarks' },
    })
  })

  it('hands the date input the bare day it holds', () => {
    expect(adminForm().publishedAt).toBe('2026-11-19')
    expect(adminForm({ publishedAt: null }).publishedAt).toBeNull()
  })

  /**
   * `authorId` is an opaque cuid, so a form loaded without the name would show a picker that
   * is selected and visibly empty. This is the read-only half of that pair.
   */
  it('carries the linked organizer name so the picker can show a selection it did not make', () => {
    expect(adminForm().linkedAuthorName).toBe('Олена Коваль')
    expect(adminForm({ author: null }).linkedAuthorName).toBeNull()
  })

  it('keeps both byline sources so the form shows which one is in use', () => {
    expect(adminForm()).toMatchObject({ authorId: 'cuid-profile', authorName: null })
    expect(adminForm({ authorId: null, authorName: 'Запрошений автор' }))
      .toMatchObject({ authorId: null, authorName: 'Запрошений автор' })
  })

  it('ignores a translation row in a locale the site does not serve', () => {
    const row = makeAdminRow()
    const mapped = adminForm({ translations: [...row.translations, { locale: 'de', title: 'Titel', content: 'Text' }] })

    expect(Object.keys(mapped.translations).sort()).toEqual(['en', 'ua'])
  })
})
