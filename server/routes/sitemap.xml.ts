import { prisma } from '../utils/prisma'
import { GROUP_TYPES } from '~~/shared/constants/groupTypes'
import { PUBLIC_GROUP_STATUSES } from '~~/shared/constants/groupStatus'
import { SITEMAP_LIMITS } from '~~/shared/constants/limits'

const HREFLANG_MAP: Record<string, string> = { ua: 'uk', en: 'en' }

/**
 * Priority per group status. A `FULL` or `COMPLETED` page still exists and must stay in
 * the sitemap — dropping it would ask search engines to deindex a URL the catalog links
 * to — but it no longer accepts applicants, so it should not compete with an open group.
 */
const GROUP_PRIORITY: Record<string, string> = {
  PUBLISHED: '0.8',
  FULL: '0.5',
  COMPLETED: '0.5',
}

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const baseUrl = config.public.siteUrl as string
  const locales = ['ua', 'en']

  // Same visibility rule as `groupRepository.buildPublishedWhere`, and no `startsAt` floor:
  // the sitemap used to hide past events while the detail lookup served them, which is how
  // an indexed group URL ended up listed nowhere.
  const groups = await prisma.group.findMany({
    where: {
      status: { in: [...PUBLIC_GROUP_STATUSES] },
      organizer: { user: { isActive: true } },
    },
    select: { slug: true, status: true, updatedAt: true },
    orderBy: { updatedAt: 'desc' },
    take: SITEMAP_LIMITS.MAX_ROWS_PER_ENTITY,
  })

  const organizers = await prisma.organizerProfile.findMany({
    where: {
      verificationStatus: 'VERIFIED',
      user: { isActive: true },
    },
    select: { slug: true, updatedAt: true },
    orderBy: { updatedAt: 'desc' },
    take: SITEMAP_LIMITS.MAX_ROWS_PER_ENTITY,
  })

  // Every category, whether or not a group of that type exists yet.
  //
  // This used to be `distinct: ['type']` over the public groups, which listed only the
  // categories that already had inventory — one out of seventeen in production. That filter
  // reads like a soft-404 guard but is not one: `/catalog/[type]` resolves for all seventeen
  // slugs with a 200, its own hand-written title and description per locale
  // (`seo.*.json → seo.typePages.*`) and a complete hreflang set from `useLocaleHead()`. A
  // category page is a landing page meant to rank before the groups arrive, so gating it on
  // inventory hid it for exactly as long as it mattered.
  //
  // It also had to be the sitemap that listed them, because nothing else could: the type
  // picker is a `<select>` that navigates through `router.push`, and `GroupCard` renders the
  // type as text, so no crawlable `<a href>` to a category existed anywhere.
  // `CatalogCategoryLinks` now provides those links; the sitemap stays the guarantee.
  const categorySlugs = GROUP_TYPES.map(type => type.slug)

  // `/privacy` and `/terms` are absent on purpose: both still carry placeholder copy
  // awaiting legal review and are marked `noindex`, so listing them here would point
  // crawlers at URLs we are simultaneously asking them not to index. They come back with
  // the reviewed copy.
  const staticPaths = ['', '/catalog', '/organizers', '/about', '/faq', '/contacts']

  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n'
  xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n'
  xml += '  xmlns:xhtml="http://www.w3.org/1999/xhtml">\n'

  for (const path of staticPaths) {
    for (const loc of locales) {
      xml += '  <url>\n'
      xml += `    <loc>${baseUrl}/${loc}${path}</loc>\n`
      for (const alt of locales) {
        const altHreflang = HREFLANG_MAP[alt] ?? alt
        xml += `    <xhtml:link rel="alternate" hreflang="${altHreflang}" href="${baseUrl}/${alt}${path}" />\n`
      }
      xml += `    <xhtml:link rel="alternate" hreflang="x-default" href="${baseUrl}/ua${path}" />\n`
      xml += `    <priority>${path === '' ? '1.0' : '0.8'}</priority>\n`
      xml += `    <changefreq>daily</changefreq>\n`
      xml += '  </url>\n'
    }
  }

  for (const typeSlug of categorySlugs) {
    for (const loc of locales) {
      xml += '  <url>\n'
      xml += `    <loc>${baseUrl}/${loc}/catalog/${typeSlug}</loc>\n`
      for (const alt of locales) {
        const altHreflang = HREFLANG_MAP[alt] ?? alt
        xml += `    <xhtml:link rel="alternate" hreflang="${altHreflang}" href="${baseUrl}/${alt}/catalog/${typeSlug}" />\n`
      }
      xml += `    <xhtml:link rel="alternate" hreflang="x-default" href="${baseUrl}/ua/catalog/${typeSlug}" />\n`
      xml += '    <priority>0.7</priority>\n'
      xml += '    <changefreq>weekly</changefreq>\n'
      xml += '  </url>\n'
    }
  }

  for (const group of groups) {
    for (const loc of locales) {
      xml += '  <url>\n'
      xml += `    <loc>${baseUrl}/${loc}/groups/${group.slug}</loc>\n`
      for (const alt of locales) {
        const altHreflang = HREFLANG_MAP[alt] ?? alt
        xml += `    <xhtml:link rel="alternate" hreflang="${altHreflang}" href="${baseUrl}/${alt}/groups/${group.slug}" />\n`
      }
      xml += `    <xhtml:link rel="alternate" hreflang="x-default" href="${baseUrl}/ua/groups/${group.slug}" />\n`
      xml += `    <lastmod>${group.updatedAt.toISOString().split('T')[0]}</lastmod>\n`
      xml += `    <priority>${GROUP_PRIORITY[group.status] ?? '0.5'}</priority>\n`
      xml += '    <changefreq>weekly</changefreq>\n'
      xml += '  </url>\n'
    }
  }

  for (const org of organizers) {
    for (const loc of locales) {
      xml += '  <url>\n'
      xml += `    <loc>${baseUrl}/${loc}/organizers/${org.slug}</loc>\n`
      for (const alt of locales) {
        const altHreflang = HREFLANG_MAP[alt] ?? alt
        xml += `    <xhtml:link rel="alternate" hreflang="${altHreflang}" href="${baseUrl}/${alt}/organizers/${org.slug}" />\n`
      }
      xml += `    <xhtml:link rel="alternate" hreflang="x-default" href="${baseUrl}/ua/organizers/${org.slug}" />\n`
      xml += `    <lastmod>${org.updatedAt.toISOString().split('T')[0]}</lastmod>\n`
      xml += '    <priority>0.6</priority>\n'
      xml += '    <changefreq>monthly</changefreq>\n'
      xml += '  </url>\n'
    }
  }

  xml += '</urlset>\n'

  setResponseHeader(event, 'Content-Type', 'application/xml')
  return xml
})
