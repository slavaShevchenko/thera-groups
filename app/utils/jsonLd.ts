import type { GroupData } from '~~/types'

const SCHEMA_ORG = 'https://schema.org'

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

  // No invented address: an OFFLINE group whose `location` is empty simply gets no
  // location, which is honest, rather than a Place named "Онлайн".
  const place = group.location
    ? { '@type': 'Place', 'name': group.location, 'address': group.location }
    : null

  const virtual = { '@type': 'VirtualLocation', 'url': canonicalUrl }

  // A hybrid event happens in both places, and MixedEventAttendanceMode is only backed up
  // by a trail that says so.
  const location = group.format === 'ONLINE'
    ? virtual
    : group.format === 'HYBRID'
      ? (place ? [virtual, place] : virtual)
      : (place ?? undefined)

  // An organizer without a slug has no public page; a `url` ending in `/organizers/`
  // would point at a route that does not exist.
  const organizerUrl = group.organizer?.slug
    ? absolute(siteUrl, `/${locale}/organizers/${group.organizer.slug}`)
    : undefined

  return JSON.stringify({
    '@context': SCHEMA_ORG,
    '@type': 'Event',
    'name': group.title,
    'description': group.description?.slice(0, 200),
    'url': canonicalUrl,
    'image': absolute(siteUrl, formatImage(group.format)),
    'startDate': group.startsAt,
    'endDate': group.endsAt,
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
