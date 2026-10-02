import { LEGACY_SLUG_REDIRECTS } from '~~/shared/utils/groupTypeSlug'

const CATALOG_TYPE_PATH = /^\/(ua|en)\/catalog\/([^/?#]+)\/?$/

// Retired catalog type slugs must keep resolving for search engines and bookmarked
// links, so they answer with a permanent redirect instead of the page's own 404.
export default defineEventHandler((event) => {
  const url = getRequestURL(event)
  const match = CATALOG_TYPE_PATH.exec(url.pathname)
  if (!match) return

  const locale = match[1]
  const slug = match[2]
  const target = slug ? LEGACY_SLUG_REDIRECTS[slug] : undefined
  if (!locale || !target) return

  return sendRedirect(event, `/${locale}/catalog/${target}${url.search}`, 301)
})
