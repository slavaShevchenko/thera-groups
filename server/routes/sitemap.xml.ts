import { prisma } from '../utils/prisma'
import { groupTypeSlugMap } from '~~/shared/constants/groupTypes'
import { PUBLIC_GROUP_STATUSES } from '~~/shared/constants/groupStatus'

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
    take: 50000,
  })

  const organizers = await prisma.organizerProfile.findMany({
    where: {
      verificationStatus: 'VERIFIED',
      user: { isActive: true },
    },
    select: { slug: true, updatedAt: true },
    orderBy: { updatedAt: 'desc' },
    take: 50000,
  })

  const groupsWithTypes = await prisma.group.findMany({
    where: {
      status: { in: [...PUBLIC_GROUP_STATUSES] },
      type: { not: null },
      organizer: { user: { isActive: true } },
    },
    select: { type: true },
    distinct: ['type'],
  })
  const activeTypeSlugs = groupsWithTypes
    .map(g => g.type ? groupTypeSlugMap[g.type] : null)
    .filter((s): s is string => s !== null)

  const staticPaths = ['', '/catalog', '/organizers', '/about', '/faq', '/contacts', '/privacy', '/terms']

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

  for (const typeSlug of activeTypeSlugs) {
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
