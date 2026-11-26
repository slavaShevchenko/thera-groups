import type { ArticleData, GroupData } from '~~/types'
import { HREFLANG_LOCALES } from '~~/shared/constants/locales'

const SCHEMA_ORG = 'https://schema.org'

/** The site's own mark, used as the publisher `logo` in Article markup. */
const SITE_LOGO_PATH = '/logo/logo.webp'

/**
 * The image an article advertises when it has none of its own.
 *
 * `image` is the one Article property Google treats as close to required — a page without it
 * is dropped from the article rich result rather than merely warned about — and an editorial
 * body written in markdown may legitimately contain no picture at all. Falling back to the
 * same asset `useSeoPage()` uses for `og:image` keeps the two agreeing, which is what a
 * crawler checks when it sees a headline in a search result and a card in a feed.
 */
const DEFAULT_ARTICLE_IMAGE_PATH = '/images/og-default.png'

/**
 * `siteUrl` never carries a trailing slash — it is the same value `useSeoPage()` builds
 * canonical URLs from, and both must agree or the head contradicts itself.
 */
function absolute(siteUrl: string, path: string): string {
  return `${siteUrl}${path.startsWith('/') ? '' : '/'}${path}`
}

function formatImage(format: string | null | undefined): string {
  return `/images/card/${(format ?? 'online').toLowerCase()}.webp`
}

export interface BreadcrumbJsonLdInput {
  items: { name: string, path?: string }[]
  siteUrl: string
  /** Route path of the page being rendered, used for the last (current) step. */
  currentPath: string
  indexable?: boolean
}

/**
 * BreadcrumbList for the document head, or null when there is nothing indexable to say.
 *
 * Built from `siteUrl`, never from `useRequestURL()`: behind a proxy or on a preview
 * deployment the request origin is not the canonical host, and a crawler that reads the
 * internal one is handed a trail of URLs that 404 in production.
 */
export function buildBreadcrumbJsonLd(input: BreadcrumbJsonLdInput): string | null {
  const { items, siteUrl, currentPath, indexable = true } = input

  if (!indexable || items.length === 0) return null

  const itemListElement = items.map((item, index) => {
    const element: Record<string, unknown> = {
      '@type': 'ListItem',
      'position': index + 1,
      'name': item.name,
    }

    // The current page carries no `path` — the caller knows it, and a step without a URL
    // is a step Google drops from the trail.
    const path = item.path || (index === items.length - 1 ? currentPath : '')
    if (path) element.item = absolute(siteUrl, path)

    return element
  })

  return JSON.stringify({
    '@context': SCHEMA_ORG,
    '@type': 'BreadcrumbList',
    'itemListElement': itemListElement,
  })
}

export interface GroupEventJsonLdInput {
  group: GroupData
  siteUrl: string
  /** Absolute URL of the group page — the Event's own `url` and the offer's landing page. */
  canonicalUrl: string
  locale: string
  /**
   * Whether the group still accepts applications. Decided by the caller from
   * `groupAcceptsApplications()`, because a finished or full event marked `InStock` is
   * how a page earns a structured-data warning instead of a click.
   */
  acceptsApplications: boolean
}

export function buildGroupEventJsonLd(input: GroupEventJsonLdInput): string {
  const { group, siteUrl, canonicalUrl, locale, acceptsApplications } = input

  // Google's Event spec (revised 2025-06-05) dropped VirtualLocation, `eventAttendanceMode`
  // and `location.url`, requires `location` to be a Place carrying a PostalAddress `address`,
  // and states that "Virtual experiences that have no real-world component aren't supported".
  // So an ONLINE group cannot earn the event rich result whatever goes here, and an invented
  // address would be false structured data. This Place stays anyway: it is valid schema.org,
  // Bing and AI crawlers still read it, and the "missing address" it draws from Google's
  // report is a known won't-fix rather than a defect to chase.
  const onlinePlace = { '@type': 'Place', 'name': 'Online', 'url': canonicalUrl }

  // Wrapped in an object because Google's parser reports a bare string `address` as missing
  // even though schema.org allows Text there. `streetAddress` carries the whole line:
  // `group.location` is free text an organizer typed, and splitting it into locality, postal
  // code and region would mean guessing.
  const offlinePlace = group.location
    ? {
        '@type': 'Place',
        'name': group.location,
        'address': { '@type': 'PostalAddress', 'streetAddress': group.location },
      }
    : null

  // A hybrid event is marked up at its physical venue only. An array leading with the
  // addressless online Place fails Google's `address` requirement for the whole page, and
  // `MixedEventAttendanceMode` below already says the event also happens online.
  const location = group.format === 'ONLINE'
    ? onlinePlace
    : group.format === 'HYBRID'
      ? (offlinePlace ?? onlinePlace)
      : (offlinePlace ?? undefined)

  // An organizer without a slug has no public page; a `url` ending in `/organizers/`
  // would point at a route that does not exist.
  const organizerUrl = group.organizer?.slug
    ? absolute(siteUrl, `/${locale}/organizers/${group.organizer.slug}`)
    : undefined

  return JSON.stringify({
    '@context': SCHEMA_ORG,
    '@type': 'Event',
    'name': group.title,
    // The server's prose cut of the description, not its markdown source: `##` and `**` in a
    // structured-data description are what a crawler shows in a rich result.
    'description': group.metaDescription || undefined,
    'url': canonicalUrl,
    'image': absolute(siteUrl, formatImage(group.format)),
    // A group that has not been dated yet carries `null` here. `JSON.stringify` keeps an
    // explicit null, and `"startDate": null` is an invalid Event to a crawler — the field
    // is dropped instead, the same way a missing location is.
    ...(group.startsAt ? { startDate: group.startsAt } : {}),
    ...(group.endsAt ? { endDate: group.endsAt } : {}),
    'eventStatus': `${SCHEMA_ORG}/EventScheduled`,
    'eventAttendanceMode': group.format === 'ONLINE'
      ? `${SCHEMA_ORG}/OnlineEventAttendanceMode`
      : group.format === 'HYBRID'
        ? `${SCHEMA_ORG}/MixedEventAttendanceMode`
        : `${SCHEMA_ORG}/OfflineEventAttendanceMode`,
    'location': location,
    'organizer': group.organizer
      ? {
          '@type': 'Person',
          'name': `${group.organizer.firstName} ${group.organizer.lastName}`,
          'url': organizerUrl,
        }
      : undefined,
    'offers': group.priceAmount != null && acceptsApplications
      ? {
          '@type': 'Offer',
          'url': canonicalUrl,
          'price': group.priceAmount,
          'priceCurrency': group.currency || 'UAH',
          'availability': `${SCHEMA_ORG}/InStock`,
        }
      : undefined,
  })
}

export interface ArticleJsonLdInput {
  article: ArticleData
  siteUrl: string
  /** Absolute URL of the article page — `mainEntityOfPage` and the author's `url` base. */
  canonicalUrl: string
  /** Path locale (`ua` | `en`), the same value `buildGroupEventJsonLd` takes. */
  locale: string
  /** Site name, from `t('seo.siteName')`. A util has no i18n, so the caller supplies it. */
  publisherName: string
}

/**
 * Article markup for a published article page.
 *
 * Three decisions worth stating, because all three look like omissions:
 *
 * `datePublished` is a bare `YYYY-MM-DD` while `dateModified` is a full instant. That is what
 * the two actually mean — an article is published on a day, and it is revised at a moment —
 * and Google accepts date-only for the former. Sending the stored instant for `datePublished`
 * instead would print the previous evening to any crawler normalizing to a US timezone.
 *
 * `dateModified` never sorts before `datePublished`. The publication day is chosen in Kyiv
 * while the instant is stored in UTC, and a crawler reads a bare date as UTC midnight — so an
 * article last touched in the first two hours of a Kyiv day is still on the previous day as
 * far as its `updatedAt` goes, and the pair claims it was revised before it was published.
 * Falling back to the publication day is both true ("last modified the day it came out") and
 * comparable with the value sitting next to it.
 *
 * `author` is never dropped. Google treats it as required for the Article rich result, so an
 * unsigned piece is attributed to the publisher as an Organization rather than left out: that
 * is the honest reading of "the site wrote this", and it keeps the markup valid. A named author
 * becomes a Person, linked to their profile only when they have one that is publicly
 * reachable — the same rule `buildGroupEventJsonLd` applies to an organizer, since `url`
 * pointing at `/organizers/` is a link to a route that does not exist.
 */
export function buildArticleJsonLd(input: ArticleJsonLdInput): string {
  const { article, siteUrl, canonicalUrl, locale, publisherName } = input

  const authorUrl = article.author?.slug
    ? absolute(siteUrl, `/${locale}/organizers/${article.author.slug}`)
    : undefined

  const dateModified = Date.parse(article.updatedAt) < Date.parse(`${article.publishedDate}T00:00:00Z`)
    ? article.publishedDate
    : article.updatedAt

  const publisher = {
    '@type': 'Organization',
    'name': publisherName,
    'url': siteUrl,
    'logo': {
      '@type': 'ImageObject',
      'url': absolute(siteUrl, SITE_LOGO_PATH),
    },
  }

  return JSON.stringify({
    '@context': SCHEMA_ORG,
    '@type': 'Article',
    // Google truncates a longer headline in the rich result anyway; cutting it here means the
    // cut is on a word boundary rather than mid-word.
    'headline': article.title.slice(0, 110),
    'description': article.metaDescription,
    'image': [absolute(siteUrl, DEFAULT_ARTICLE_IMAGE_PATH)],
    'datePublished': article.publishedDate,
    'dateModified': dateModified,
    'inLanguage': HREFLANG_LOCALES[locale] ?? locale,
    'author': article.author
      ? {
          '@type': 'Person',
          'name': article.author.name,
          'url': authorUrl,
        }
      : publisher,
    'publisher': publisher,
    'mainEntityOfPage': { '@type': 'WebPage', '@id': canonicalUrl },
  })
}
