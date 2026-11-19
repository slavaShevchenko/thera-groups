import type { ArticleData, GroupData, OrganizerProfile } from '~~/types'

const LOCALE_SEGMENTS = ['ua', 'en']

export const BREADCRUMB_ENTITY_KEY = 'psyGroup.breadcrumbEntity'

export type BreadcrumbEntityKind = 'group' | 'organizer' | 'article'

export interface BreadcrumbEntityTarget {
  kind: BreadcrumbEntityKind
  slug: string
  /**
   * The path's locale segment.
   *
   * Only the article endpoint reads it — `GET /api/articles/[slug]` takes `locale` as a query
   * parameter, because an article's title and body live in a translation row and a breadcrumb
   * fetched without one would name an English page with its Ukrainian title. Groups and
   * organizers carry their own locale inside the row, so they ignore this field.
   */
  locale: 'ua' | 'en'
}

// Routes whose last breadcrumb is an entity name rather than a translated label.
// Mirrors the branches in useBreadcrumbs(): /groups/my, /groups/new,
// /groups/edit/[slug] and /groups/applications/[slug] all render a t() label, so
// they need no prefetch. Only a two-segment path carries an entity.
export function resolveBreadcrumbTarget(
  path: string,
  slugParam?: string | string[],
): BreadcrumbEntityTarget | null {
  const segments = path.split('/').filter(Boolean)
  const first = segments[0]
  const locale: 'ua' | 'en' = first === 'en' ? 'en' : 'ua'
  if (first && LOCALE_SEGMENTS.includes(first)) segments.shift()
  if (segments.length !== 2) return null

  const section = segments[0]
  const rawSlug = segments[1]
  if (!section || !rawSlug) return null
  if (section !== 'groups' && section !== 'organizers' && section !== 'articles') return null
  if (section === 'groups' && (rawSlug === 'my' || rawSlug === 'new')) return null

  // Prefer the router's already-decoded param: the pages build their asyncData key
  // from route.params.slug, so an encoded segment here would produce a different
  // key and silently defeat the reuse.
  const slug = typeof slugParam === 'string' && slugParam
    ? slugParam
    : decodeURIComponent(rawSlug)

  const kind: BreadcrumbEntityKind = section === 'groups'
    ? 'group'
    : section === 'organizers'
      ? 'organizer'
      : 'article'

  return { kind, slug, locale }
}

// Must stay identical to the keys the detail pages pass to useFetch/useAsyncData,
// otherwise the prefetched payload is not reused and the route fetches twice.
// The locale is deliberately not part of it: switching locale navigates to a different
// path, which re-runs the middleware and overwrites the entry before the page reads it.
export function breadcrumbAsyncDataKey(target: BreadcrumbEntityTarget): string {
  return `${target.kind}-${target.slug}`
}

export function breadcrumbEntityEndpoint(target: BreadcrumbEntityTarget): string {
  if (target.kind === 'article') {
    return `/api/articles/${target.slug}?locale=${target.locale}`
  }
  return `/api/${target.kind === 'group' ? 'groups' : 'organizers'}/${target.slug}`
}

export function breadcrumbEntityName(target: BreadcrumbEntityTarget, entity: unknown): string {
  if (target.kind === 'group') {
    return (entity as GroupData | null)?.title || target.slug
  }
  if (target.kind === 'article') {
    return (entity as ArticleData | null)?.title || target.slug
  }
  const organizer = entity as OrganizerProfile | null
  const name = [organizer?.firstName, organizer?.lastName].filter(Boolean).join(' ')
  return name || target.slug
}
