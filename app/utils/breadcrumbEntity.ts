import type { GroupData, OrganizerProfile } from '~~/types'

const LOCALE_SEGMENTS = ['ua', 'en']

export const BREADCRUMB_ENTITY_KEY = 'psyGroup.breadcrumbEntity'

export type BreadcrumbEntityKind = 'group' | 'organizer'

export interface BreadcrumbEntityTarget {
  kind: BreadcrumbEntityKind
  slug: string
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
  if (segments[0] && LOCALE_SEGMENTS.includes(segments[0])) segments.shift()
  if (segments.length !== 2) return null

  const section = segments[0]
  const rawSlug = segments[1]
  if (!section || !rawSlug) return null
  if (section !== 'groups' && section !== 'organizers') return null
  if (section === 'groups' && (rawSlug === 'my' || rawSlug === 'new')) return null

  // Prefer the router's already-decoded param: the pages build their asyncData key
  // from route.params.slug, so an encoded segment here would produce a different
  // key and silently defeat the reuse.
  const slug = typeof slugParam === 'string' && slugParam
    ? slugParam
    : decodeURIComponent(rawSlug)

  return { kind: section === 'groups' ? 'group' : 'organizer', slug }
}

// Must stay identical to the keys the detail pages pass to useFetch/useAsyncData,
// otherwise the prefetched payload is not reused and the route fetches twice.
export function breadcrumbAsyncDataKey(target: BreadcrumbEntityTarget): string {
  return `${target.kind}-${target.slug}`
}

export function breadcrumbEntityEndpoint(target: BreadcrumbEntityTarget): string {
  return `/api/${target.kind === 'group' ? 'groups' : 'organizers'}/${target.slug}`
}

export function breadcrumbEntityName(target: BreadcrumbEntityTarget, entity: unknown): string {
  if (target.kind === 'group') {
    return (entity as GroupData | null)?.title || target.slug
  }
  const organizer = entity as OrganizerProfile | null
  const name = [organizer?.firstName, organizer?.lastName].filter(Boolean).join(' ')
  return name || target.slug
}
