import { prisma } from '../utils/prisma'
import { articleRepository } from '../repositories/articleRepository'
import { GROUP_TYPES } from '~~/shared/constants/groupTypes'
import { PUBLIC_GROUP_STATUSES } from '~~/shared/constants/groupStatus'
import { HREFLANG_LOCALES } from '~~/shared/constants/locales'
import { SITEMAP_LIMITS } from '~~/shared/constants/limits'

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

  // Only PUBLISHED rows, and every one of them exists in both locales: `articleService`
  // refuses to publish an article that is missing a translation, which is what makes the
  // hreflang pair emitted below honest. Listing a draft would advertise a URL that 404s.
  const articles = await articleRepository.findPublishedForSitemap(
    SITEMAP_LIMITS.MAX_ARTICLE_ROWS,
  )

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

  const staticPaths = ['', '/catalog', '/organizers', '/articles', '/about', '/faq', '/contacts', '/privacy', '/terms']

  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n'
  xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n'
  xml += '  xmlns:xhtml="http://www.w3.org/1999/xhtml">\n'

  for (const path of staticPaths) {
    for (const loc of locales) {
      const locUrl = `${baseUrl}/${loc}${path}`.replace(/\/$/, '')
      xml += '  <url>\n'
      xml += `    <loc>${locUrl}</loc>\n`
      for (const alt of locales) {
        const altHreflang = HREFLANG_LOCALES[alt] ?? alt
        const altUrl = `${baseUrl}/${alt}${path}`.replace(/\/$/, '')
        xml += `    <xhtml:link rel="alternate" hreflang="${altHreflang}" href="${altUrl}" />\n`
      }
      const xDefaultUrl = `${baseUrl}/ua${path}`.replace(/\/$/, '')
      xml += `    <xhtml:link rel="alternate" hreflang="x-default" href="${xDefaultUrl}" />\n`
      xml += `    <priority>${path === '' ? '1.0' : '0.8'}</priority>\n`
      xml += `    <changefreq>daily</changefreq>\n`
      xml += '  </url>\n'
    }
  }

  for (const typeSlug of categorySlugs) {
    for (const loc of locales) {
      const locUrl = `${baseUrl}/${loc}/catalog/${typeSlug}`.replace(/\/$/, '')
      xml += '  <url>\n'
      xml += `    <loc>${locUrl}</loc>\n`
      for (const alt of locales) {
        const altHreflang = HREFLANG_LOCALES[alt] ?? alt
        const altUrl = `${baseUrl}/${alt}/catalog/${typeSlug}`.replace(/\/$/, '')
        xml += `    <xhtml:link rel="alternate" hreflang="${altHreflang}" href="${altUrl}" />\n`
      }
      const xDefaultUrl = `${baseUrl}/ua/catalog/${typeSlug}`.replace(/\/$/, '')
      xml += `    <xhtml:link rel="alternate" hreflang="x-default" href="${xDefaultUrl}" />\n`
      xml += '    <priority>0.7</priority>\n'
      xml += '    <changefreq>weekly</changefreq>\n'
      xml += '  </url>\n'
    }
  }

  for (const group of groups) {
    for (const loc of locales) {
      const locUrl = `${baseUrl}/${loc}/groups/${group.slug}`.replace(/\/$/, '')
      xml += '  <url>\n'
      xml += `    <loc>${locUrl}</loc>\n`
      for (const alt of locales) {
        const altHreflang = HREFLANG_LOCALES[alt] ?? alt
        const altUrl = `${baseUrl}/${alt}/groups/${group.slug}`.replace(/\/$/, '')
        xml += `    <xhtml:link rel="alternate" hreflang="${altHreflang}" href="${altUrl}" />\n`
      }
      const xDefaultUrl = `${baseUrl}/ua/groups/${group.slug}`.replace(/\/$/, '')
      xml += `    <xhtml:link rel="alternate" hreflang="x-default" href="${xDefaultUrl}" />\n`
      xml += `    <lastmod>${group.updatedAt.toISOString().split('T')[0]}</lastmod>\n`
      xml += `    <priority>${GROUP_PRIORITY[group.status] ?? '0.5'}</priority>\n`
      xml += '    <changefreq>weekly</changefreq>\n'
      xml += '  </url>\n'
    }
  }

  for (const org of organizers) {
    for (const loc of locales) {
      const locUrl = `${baseUrl}/${loc}/organizers/${org.slug}`.replace(/\/$/, '')
      xml += '  <url>\n'
      xml += `    <loc>${locUrl}</loc>\n`
      for (const alt of locales) {
        const altHreflang = HREFLANG_LOCALES[alt] ?? alt
        const altUrl = `${baseUrl}/${alt}/organizers/${org.slug}`.replace(/\/$/, '')
        xml += `    <xhtml:link rel="alternate" hreflang="${altHreflang}" href="${altUrl}" />\n`
      }
      const xDefaultUrl = `${baseUrl}/ua/organizers/${org.slug}`.replace(/\/$/, '')
      xml += `    <xhtml:link rel="alternate" hreflang="x-default" href="${xDefaultUrl}" />\n`
      xml += `    <lastmod>${org.updatedAt.toISOString().split('T')[0]}</lastmod>\n`
      xml += '    <priority>0.6</priority>\n'
      xml += '    <changefreq>monthly</changefreq>\n'
      xml += '  </url>\n'
    }
  }

  // Editorial content: ranked with the category pages rather than below them, because an
  // article is what a search for a question — rather than for an event — should land on.
  // `monthly` rather than `weekly`: a published article is finished, and the only change it
  // sees is a correction.
  for (const article of articles) {
    for (const loc of locales) {
      const locUrl = `${baseUrl}/${loc}/articles/${article.slug}`.replace(/\/$/, '')
      xml += '  <url>\n'
      xml += `    <loc>${locUrl}</loc>\n`
      for (const alt of locales) {
        const altHreflang = HREFLANG_LOCALES[alt] ?? alt
        const altUrl = `${baseUrl}/${alt}/articles/${article.slug}`.replace(/\/$/, '')
        xml += `    <xhtml:link rel="alternate" hreflang="${altHreflang}" href="${altUrl}" />\n`
      }
      const xDefaultUrl = `${baseUrl}/ua/articles/${article.slug}`.replace(/\/$/, '')
      xml += `    <xhtml:link rel="alternate" hreflang="x-default" href="${xDefaultUrl}" />\n`
      xml += `    <lastmod>${article.updatedAt.toISOString().split('T')[0]}</lastmod>\n`
      xml += '    <priority>0.7</priority>\n'
      xml += '    <changefreq>monthly</changefreq>\n'
      xml += '  </url>\n'
    }
  }

  xml += '</urlset>\n'

  setResponseHeader(event, 'Content-Type', 'application/xml')
  return xml
})
