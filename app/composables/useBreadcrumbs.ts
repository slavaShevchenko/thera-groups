import { slugToGroupTypeEnum } from '~~/shared/utils/groupTypeSlug'

export interface BreadcrumbItem {
  name: string
  path?: string
}

export function useBreadcrumbs(): ComputedRef<BreadcrumbItem[]> {
  const route = useRoute()
  const { t, locale } = useLocale()
  const nuxtApp = useNuxtApp()

  return computed(() => {
    const path = route.path
    const loc = locale.value

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
        // /groups/[slug] — fetch group title from payload or API
        const groupSlug = segments[1]
        const groupName = getGroupTitle(groupSlug, nuxtApp)
        items.push({ name: t('breadcrumbs.catalog'), path: `/${loc}/catalog` })
        items.push({ name: groupName })
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
        const orgSlug = segments[1]
        const orgName = getOrganizerName(orgSlug, nuxtApp)
        items.push({ name: t('breadcrumbs.organizers'), path: `/${loc}/organizers` })
        items.push({ name: orgName })
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

// Get group title from Nuxt payload (data already loaded on page)
function getGroupTitle(slug: string, nuxtApp: ReturnType<typeof useNuxtApp>): string {
  const payload = nuxtApp.payload?.data || {}
  for (const k in payload) {
    const data = payload[k]
    if (data && typeof data === 'object' && !Array.isArray(data) && 'slug' in data && data.slug === slug && 'title' in data) {
      return (data.title as string) || slug
    }
  }
  return slug
}

// Get organizer name from Nuxt payload
function getOrganizerName(slug: string, nuxtApp: ReturnType<typeof useNuxtApp>): string {
  const payload = nuxtApp.payload?.data || {}
  for (const k in payload) {
    const data = payload[k]
    if (
      data && typeof data === 'object' && !Array.isArray(data)
      && 'slug' in data && data.slug === slug
      && ('firstName' in data || 'lastName' in data)
    ) {
      const name = [data.firstName, data.lastName].filter(Boolean).join(' ')
      if (name) return name
    }
  }
  return slug
}

// Get catalog type display name from slug (e.g. "therapeutic" -> "Терапевтичні")
function getCatalogTypeName(typeSlug: string, t: (_key: string) => string): string {
  const groupType = slugToGroupTypeEnum(typeSlug)
  if (groupType) {
    return t(`groupTypes.${groupType}`)
  }
  return typeSlug
}
