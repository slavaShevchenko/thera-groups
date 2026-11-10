import { slugToGroupType } from '~~/shared/constants/groupTypes'
import { BREADCRUMB_ENTITY_KEY } from '~/utils/breadcrumbEntity'

export interface BreadcrumbItem {
  name: string
  path?: string
}

export function useBreadcrumbs(): ComputedRef<BreadcrumbItem[]> {
  const route = useRoute()
  const { t, pathLocale } = useLocale()
  // Filled before render by middleware/breadcrumbEntity.global.ts, so SSR and the
  // client's first paint agree. Scanning nuxtApp.payload.data here cannot: the layout
  // renders <AppBreadcrumbs> before <slot>, so on SSR the page's fetch has not settled
  // yet and the scan only ever succeeded on the client — hence the hydration mismatch.
  const entityName = useState<string>(BREADCRUMB_ENTITY_KEY, () => '')

  return computed(() => {
    const path = route.path
    const loc = pathLocale.value

    // Strip locale prefix: /ua/groups/slug -> /groups/slug
    const pathWithoutLocale = path.replace(new RegExp(`^/${loc}`), '') || '/'

    // No breadcrumbs on home or auth
    if (pathWithoutLocale === '/' || pathWithoutLocale.startsWith('/auth')) {
      return []
    }

    const items: BreadcrumbItem[] = [
      { name: t('breadcrumbs.home'), path: `/${loc}` },
    ]

    const segments = pathWithoutLocale.split('/').filter(Boolean)

    // /groups, /groups/my, /groups/new, /groups/edit/[slug], /groups/applications/[slug], /groups/[slug]
    if (segments[0] === 'groups') {
      if (segments[1] === 'my') {
        items.push({ name: t('breadcrumbs.myGroups') })
      }
      else if (segments[1] === 'new') {
        items.push({ name: t('breadcrumbs.myGroups'), path: `/${loc}/groups/my` })
        items.push({ name: t('breadcrumbs.new') })
      }
      else if (segments[1] === 'edit' && segments[2]) {
        items.push({ name: t('breadcrumbs.myGroups'), path: `/${loc}/groups/my` })
        items.push({ name: t('breadcrumbs.edit') })
      }
      else if (segments[1] === 'applications' && segments[2]) {
        items.push({ name: t('breadcrumbs.myGroups'), path: `/${loc}/groups/my` })
        items.push({ name: t('breadcrumbs.applications') })
      }
      else if (segments[1]) {
        // /groups/[slug] — name resolved before render by breadcrumbEntity.global.ts
        items.push({ name: t('breadcrumbs.catalog'), path: `/${loc}/catalog` })
        items.push({ name: entityName.value || segments[1] })
      }
      else {
        items.push({ name: t('breadcrumbs.catalog') })
      }
    }

    // /catalog, /catalog/[type]
    else if (segments[0] === 'catalog') {
      if (segments[1]) {
        const typeName = getCatalogTypeName(segments[1], t)
        items.push({ name: t('breadcrumbs.catalog'), path: `/${loc}/catalog` })
        items.push({ name: typeName })
      }
      else {
        items.push({ name: t('breadcrumbs.catalog') })
      }
    }

    // /organizers, /organizers/[slug]
    else if (segments[0] === 'organizers') {
      if (segments[1]) {
        items.push({ name: t('breadcrumbs.organizers'), path: `/${loc}/organizers` })
        items.push({ name: entityName.value || segments[1] })
      }
      else {
        items.push({ name: t('breadcrumbs.organizers') })
      }
    }

    // /applications/my
    else if (segments[0] === 'applications' && segments[1] === 'my') {
      items.push({ name: t('breadcrumbs.myApplications') })
    }

    // /favorites
    else if (segments[0] === 'favorites') {
      items.push({ name: t('breadcrumbs.favorites') })
    }

    // /notifications
    else if (segments[0] === 'notifications') {
      items.push({ name: t('breadcrumbs.notifications') })
    }

    // /profile, /profile/edit
    else if (segments[0] === 'profile') {
      if (segments[1] === 'edit') {
        items.push({ name: t('breadcrumbs.profile'), path: `/${loc}/profile` })
        items.push({ name: t('breadcrumbs.profileEdit') })
      }
      else {
        items.push({ name: t('breadcrumbs.profile') })
      }
    }

    // /admin
    else if (segments[0] === 'admin') {
      items.push({ name: t('breadcrumbs.admin') })
    }

    // Info pages
    else if (segments[0] === 'about') items.push({ name: t('breadcrumbs.about') })
    else if (segments[0] === 'faq') items.push({ name: t('breadcrumbs.faq') })
    else if (segments[0] === 'contacts') items.push({ name: t('breadcrumbs.contacts') })
    else if (segments[0] === 'privacy') items.push({ name: t('breadcrumbs.privacy') })
    else if (segments[0] === 'terms') items.push({ name: t('breadcrumbs.terms') })

    return items
  })
}

// Get catalog type display name from slug (e.g. "therapeutic" -> "Терапевтичні")
function getCatalogTypeName(typeSlug: string, t: (_key: string) => string): string {
  const groupType = slugToGroupType(typeSlug)
  if (groupType) {
    return t(`groupTypes.${groupType}`)
  }
  return typeSlug
}
