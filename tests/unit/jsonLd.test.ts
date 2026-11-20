import { describe, it, expect } from 'vitest'
import type { ArticleData, GroupData } from '~~/types'
import { buildArticleJsonLd, buildBreadcrumbJsonLd, buildGroupEventJsonLd } from '~~/app/utils/jsonLd'

const SITE_URL = 'https://psygroup.org'
const CANONICAL = `${SITE_URL}/ua/groups/anxiety-group`

function makeGroup(overrides: Partial<GroupData> = {}): GroupData {
  return {
    id: 'group-1',
    slug: 'anxiety-group',
    isFavorited: false,
    createdAt: '2026-10-01T10:00:00.000Z',
    type: 'THERAPEUTIC',
    title: 'Група підтримки при тривозі',
    description: 'Опис групи',
    program: null,
    format: 'OFFLINE',
    status: 'PUBLISHED',
    startsAt: '2026-11-10T16:00:00.000Z',
    endsAt: '2026-12-10T18:00:00.000Z',
    capacity: 12,
    minParticipants: 4,
    durationHours: 2,
    certificateIssued: false,
    priceAmount: 500,
    currency: 'UAH',
    location: 'Київ, вул. Хрещатик 1',
    tags: [],
    organizer: {
      slug: 'olena-k',
      firstName: 'Олена',
      lastName: 'Коваль',
      avatarUrl: null,
      qualification: 'Психолог',
      experienceYears: 8,
      specializations: [],
      bio: null,
      verificationStatus: 'VERIFIED',
    },
    coOrganizers: [],
    viewer: { canEdit: false, canViewUnpublished: false },
    ...overrides,
  }
}

function event(overrides: Partial<GroupData> = {}, acceptsApplications = true) {
  return JSON.parse(buildGroupEventJsonLd({
    group: makeGroup(overrides),
    siteUrl: SITE_URL,
    canonicalUrl: CANONICAL,
    locale: 'ua',
    acceptsApplications,
  })) as Record<string, unknown>
}

describe('buildBreadcrumbJsonLd', () => {
  it('builds every step from siteUrl, never from the request origin', () => {
    const jsonLd = buildBreadcrumbJsonLd({
      items: [
        { name: 'Головна', path: '/ua' },
        { name: 'Каталог', path: '/ua/catalog' },
        { name: 'Група' },
      ],
      siteUrl: SITE_URL,
      currentPath: '/ua/groups/anxiety-group',
    })

    expect(JSON.parse(jsonLd!)).toEqual({
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      'itemListElement': [
        { '@type': 'ListItem', 'position': 1, 'name': 'Головна', 'item': `${SITE_URL}/ua` },
        { '@type': 'ListItem', 'position': 2, 'name': 'Каталог', 'item': `${SITE_URL}/ua/catalog` },
        { '@type': 'ListItem', 'position': 3, 'name': 'Група', 'item': CANONICAL },
      ],
    })
  })

  it('omits item on a middle step that has no path rather than inventing one', () => {
    const jsonLd = buildBreadcrumbJsonLd({
      items: [
        { name: 'Головна', path: '/ua' },
        { name: 'Без шляху' },
        { name: 'Поточна' },
      ],
      siteUrl: SITE_URL,
      currentPath: '/ua/whatever',
    })

    const steps = JSON.parse(jsonLd!).itemListElement as Record<string, unknown>[]

    expect(steps[1]).toEqual({ '@type': 'ListItem', 'position': 2, 'name': 'Без шляху' })
    expect(steps[2].item).toBe(`${SITE_URL}/ua/whatever`)
  })

  it('returns null when the page is not indexable', () => {
    expect(buildBreadcrumbJsonLd({
      items: [{ name: 'Головна', path: '/ua' }],
      siteUrl: SITE_URL,
      currentPath: '/ua/profile',
      indexable: false,
    })).toBeNull()
  })

  it('returns null when there is no trail at all', () => {
    expect(buildBreadcrumbJsonLd({
      items: [],
      siteUrl: SITE_URL,
      currentPath: '/ua',
    })).toBeNull()
  })
})

describe('buildGroupEventJsonLd', () => {
  it('carries the page URL and an absolute image', () => {
    const jsonLd = event()

    expect(jsonLd.url).toBe(CANONICAL)
    expect(jsonLd.image).toBe(`${SITE_URL}/images/card/offline.webp`)
  })

  it('picks the image from the format', () => {
    expect(event({ format: 'ONLINE' }).image).toBe(`${SITE_URL}/images/card/online.webp`)
    expect(event({ format: 'HYBRID' }).image).toBe(`${SITE_URL}/images/card/hybrid.webp`)
    expect(event({ format: null }).image).toBe(`${SITE_URL}/images/card/online.webp`)
  })

  it('gives an offline event a place whose address is a PostalAddress', () => {
    expect(event().location).toEqual({
      '@type': 'Place',
      'name': 'Київ, вул. Хрещатик 1',
      'address': { '@type': 'PostalAddress', 'streetAddress': 'Київ, вул. Хрещатик 1' },
    })
  })

  it('gives an online event a Place with the page URL', () => {
    // No `address`: an online event has none, and Google's Event spec no longer accepts a
    // VirtualLocation either. The Place is kept for schema.org consumers — see jsonLd.ts.
    expect(event({ format: 'ONLINE' }).location).toEqual({
      '@type': 'Place',
      'name': 'Online',
      'url': CANONICAL,
    })
  })

  it('gives a hybrid event its physical venue, not an addressless online Place', () => {
    expect(event({ format: 'HYBRID' }).location).toEqual({
      '@type': 'Place',
      'name': 'Київ, вул. Хрещатик 1',
      'address': { '@type': 'PostalAddress', 'streetAddress': 'Київ, вул. Хрещатик 1' },
    })
  })

  it('drops the location instead of naming an offline event "online"', () => {
    expect(event({ location: null }).location).toBeUndefined()
    expect(event({ format: 'HYBRID', location: null }).location)
      .toEqual({ '@type': 'Place', 'name': 'Online', 'url': CANONICAL })
  })

  it('points the offer at the page a ticket is claimed on', () => {
    expect(event().offers).toEqual({
      '@type': 'Offer',
      'url': CANONICAL,
      'price': 500,
      'priceCurrency': 'UAH',
      'availability': 'https://schema.org/InStock',
    })
  })

  it('omits the offer on a group that cannot be applied to', () => {
    expect(event({ status: 'FULL' }, false).offers).toBeUndefined()
  })

  it('omits the offer when there is no price', () => {
    expect(event({ priceAmount: null }).offers).toBeUndefined()
  })

  it('links the organizer only when they have a public page', () => {
    expect(event().organizer).toEqual({
      '@type': 'Person',
      'name': 'Олена Коваль',
      'url': `${SITE_URL}/ua/organizers/olena-k`,
    })

    const slugless = event({
      organizer: { ...makeGroup().organizer!, slug: '' },
    })
    expect(slugless.organizer).toEqual({ '@type': 'Person', 'name': 'Олена Коваль' })

    expect(event({ organizer: null }).organizer).toBeUndefined()
  })

  it('maps the attendance mode to the format', () => {
    expect(event({ format: 'ONLINE' }).eventAttendanceMode)
      .toBe('https://schema.org/OnlineEventAttendanceMode')
    expect(event({ format: 'HYBRID' }).eventAttendanceMode)
      .toBe('https://schema.org/MixedEventAttendanceMode')
    expect(event({ format: 'OFFLINE' }).eventAttendanceMode)
      .toBe('https://schema.org/OfflineEventAttendanceMode')
  })

  it('carries both dates when the group has them', () => {
    const jsonLd = event()

    expect(jsonLd.startDate).toBe('2026-11-10T16:00:00.000Z')
    expect(jsonLd.endDate).toBe('2026-12-10T18:00:00.000Z')
  })

  it('drops a date instead of publishing it as null', () => {
    // `JSON.parse` cannot tell an absent key from an explicit null, so the raw string is
    // what has to be asserted: `"endDate": null` is a structured-data error, and the
    // parsed object would look the same either way to a `toBeUndefined()` check on a
    // field that was never there.
    const undated = buildGroupEventJsonLd({
      group: makeGroup({ startsAt: null, endsAt: null }),
      siteUrl: SITE_URL,
      canonicalUrl: CANONICAL,
      locale: 'ua',
      acceptsApplications: true,
    })

    expect(undated).not.toContain('startDate')
    expect(undated).not.toContain('endDate')
    expect(undated).not.toContain('null')

    const openEnded = buildGroupEventJsonLd({
      group: makeGroup({ endsAt: null }),
      siteUrl: SITE_URL,
      canonicalUrl: CANONICAL,
      locale: 'ua',
      acceptsApplications: true,
    })

    expect(JSON.parse(openEnded).startDate).toBe('2026-11-10T16:00:00.000Z')
    expect(openEnded).not.toContain('endDate')
  })
})

const ARTICLE_CANONICAL = `${SITE_URL}/ua/articles/yak-obraty-hrupu`

function makeArticle(overrides: Partial<ArticleData> = {}): ArticleData {
  return {
    slug: 'yak-obraty-hrupu',
    locale: 'ua',
    title: 'Як обрати терапевтичну групу',
    content: [],
    excerpt: 'Кілька орієнтирів, які допоможуть зрозуміти, чи підходить вам формат групи.',
    metaDescription: 'Кілька орієнтирів, які допоможуть зрозуміти, чи підходить вам формат групи.',
    publishedDate: '2026-11-19',
    updatedAt: '2026-11-19T09:12:00.000Z',
    author: { name: 'Олена Коваль', slug: 'olena-k' },
    ...overrides,
  }
}

function article(overrides: Partial<ArticleData> = {}, locale = 'ua') {
  return JSON.parse(buildArticleJsonLd({
    article: makeArticle(overrides),
    siteUrl: SITE_URL,
    canonicalUrl: ARTICLE_CANONICAL,
    locale,
    publisherName: 'PsyGroup',
  })) as Record<string, unknown>
}

describe('buildArticleJsonLd', () => {
  it('describes the page as an Article the canonical URL is the main entity of', () => {
    const jsonLd = article()

    expect(jsonLd['@context']).toBe('https://schema.org')
    expect(jsonLd['@type']).toBe('Article')
    expect(jsonLd.mainEntityOfPage).toEqual({ '@type': 'WebPage', '@id': ARTICLE_CANONICAL })
  })

  it('carries the headline, the description and an absolute image', () => {
    const jsonLd = article()

    expect(jsonLd.headline).toBe('Як обрати терапевтичну групу')
    expect(jsonLd.description).toBe(makeArticle().metaDescription)
    expect(jsonLd.image).toEqual([`${SITE_URL}/images/og-default.png`])
  })

  it('cuts a headline past the length Google truncates anyway', () => {
    const jsonLd = article({ title: 'x'.repeat(200) })

    expect((jsonLd.headline as string).length).toBe(110)
  })

  /**
   * `datePublished` is a day and `dateModified` is an instant, because that is what the two
   * mean. Sending the stored instant for `datePublished` would print the previous evening to
   * a crawler normalizing to a US timezone.
   */
  it('publishes on a day and modifies at a moment', () => {
    const jsonLd = article()

    expect(jsonLd.datePublished).toBe('2026-11-19')
    expect(jsonLd.dateModified).toBe('2026-11-19T09:12:00.000Z')
  })

  /**
   * The publication day is Kyiv's and the instant is UTC, so an article last touched in the
   * first two hours of a Kyiv day carries an `updatedAt` from the day before it. Read as the
   * pair of strings a crawler gets, that is a revision preceding the publication.
   */
  it('never reports a revision before the publication day', () => {
    const jsonLd = article({
      publishedDate: '2026-11-20',
      updatedAt: '2026-11-19T23:00:05.869Z',
    })

    expect(jsonLd.datePublished).toBe('2026-11-20')
    expect(jsonLd.dateModified).toBe('2026-11-20')
  })

  it('keeps the real moment once it falls on or after the publication day', () => {
    const jsonLd = article({
      publishedDate: '2026-11-19',
      updatedAt: '2026-11-20T09:12:00.000Z',
    })

    expect(jsonLd.dateModified).toBe('2026-11-20T09:12:00.000Z')
  })

  /**
   * `hreflang`, `xml:lang` and `inLanguage` all want the primary subtag. `uk-UA` would claim
   * the page is for Ukrainian as spoken in Ukraine, and a language tag carrying a region is
   * one Google reads as a different language from `uk`.
   */
  it('names the language without a region', () => {
    expect(article({}, 'ua').inLanguage).toBe('uk')
    expect(article({}, 'en').inLanguage).toBe('en')
  })

  it('links a named author to their profile when they have one', () => {
    expect(article().author).toEqual({
      '@type': 'Person',
      'name': 'Олена Коваль',
      'url': `${SITE_URL}/ua/organizers/olena-k`,
    })
  })

  it('follows the locale the page is rendered in when linking the author', () => {
    expect(article({}, 'en').author).toMatchObject({
      url: `${SITE_URL}/en/organizers/olena-k`,
    })
  })

  // A free-text byline has no profile, and a linked organizer whose profile is not publicly
  // reachable arrives with `slug: null`. Either way a `url` of `/organizers/` would point at
  // a route that does not exist.
  it('names an author without a public page and does not invent a link', () => {
    expect(article({ author: { name: 'Запрошений автор', slug: null } }).author)
      .toEqual({ '@type': 'Person', 'name': 'Запрошений автор' })
  })

  /**
   * Google treats `author` as required for the Article rich result, so an unsigned piece is
   * attributed to the publisher rather than left out — the honest reading of "the site wrote
   * this", and the difference between a valid Article and one dropped from the rich result.
   */
  it('attributes an unsigned article to the publisher instead of dropping the author', () => {
    const jsonLd = article({ author: null })

    expect(jsonLd.author).toEqual(jsonLd.publisher)
    expect(jsonLd.author).toMatchObject({ '@type': 'Organization', 'name': 'PsyGroup' })
  })

  it('describes the publisher with the site logo, absolutely', () => {
    expect(article().publisher).toEqual({
      '@type': 'Organization',
      'name': 'PsyGroup',
      'url': SITE_URL,
      'logo': { '@type': 'ImageObject', 'url': `${SITE_URL}/logo/logo.webp` },
    })
  })

  it('emits no null, which a crawler reads as a value it cannot use', () => {
    expect(buildArticleJsonLd({
      article: makeArticle({ author: null }),
      siteUrl: SITE_URL,
      canonicalUrl: ARTICLE_CANONICAL,
      locale: 'ua',
      publisherName: 'PsyGroup',
    })).not.toContain('null')
  })
})
