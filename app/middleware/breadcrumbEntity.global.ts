import {
  BREADCRUMB_ENTITY_KEY,
  breadcrumbAsyncDataKey,
  breadcrumbEntityEndpoint,
  breadcrumbEntityName,
  resolveBreadcrumbTarget,
} from '~/utils/breadcrumbEntity'

// layouts/default.vue renders <AppBreadcrumbs> before <slot>, so during SSR the
// detail page's useFetch has not populated the payload yet and the breadcrumb fell
// back to the raw slug — in the HTML, in the JSON-LD BreadcrumbList, and at odds with
// the value the client computed after hydration. Middleware runs before render, so
// resolving the entity here fixes all three at once.
//
// The result is written into payload.data under the page's own asyncData key, which
// the page then picks up through an explicit getCachedData. Two details this depends
// on, both measured rather than assumed:
//   - Sharing the key alone is not enough. Nuxt's default getCachedData returns
//     nuxtApp.static.data on a server render, which only the client payload plugin
//     ever fills, so the page would fetch a second time.
//   - useAsyncData is deliberately NOT used here. Called from middleware on a server
//     render it runs its handler twice, which would double the database work for
//     every group and organizer page view. A plain fetch runs once.
export default defineNuxtRouteMiddleware(async (to) => {
  const entityName = useState<string>(BREADCRUMB_ENTITY_KEY, () => '')
  const target = resolveBreadcrumbTarget(to.path, to.params.slug)

  if (!target) {
    entityName.value = ''
    return
  }

  // useRequestFetch forwards the incoming request's headers on the server, and is plain
  // $fetch on the client. The headers matter: without them the API's getUser() sees no
  // session, so an unpublished group would resolve to a 404 for its own owner — who
  // would then be served that 404 by the page, since the page reuses this cache entry.
  try {
    const entity: unknown = await useRequestFetch()(breadcrumbEntityEndpoint(target))
    useNuxtApp().payload.data[breadcrumbAsyncDataKey(target)] = entity
    entityName.value = breadcrumbEntityName(target, entity)
  }
  catch {
    // Leave payload.data untouched so the detail page performs its own request and
    // raises its own localized error instead of navigation aborting here.
    entityName.value = target.slug
  }
})
