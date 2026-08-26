import { prisma } from '../utils/prisma'

export default defineEventHandler(async (event) => {
  const baseUrl = 'https://theragroups.org'
  const locales = ['ua', 'en']

  const groups = await prisma.group.findMany({
    where: { status: 'PUBLISHED' },
    select: { slug: true, updatedAt: true },
    orderBy: { updatedAt: 'desc' },
  })

  const organizers = await prisma.organizerProfile.findMany({
    where: { verificationStatus: 'VERIFIED' },
    select: { slug: true, updatedAt: true },
    orderBy: { updatedAt: 'desc' },
  })

  const staticPaths = ['', '/groups', '/organizers']

  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n'
  xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n'
  xml += '  xmlns:xhtml="http://www.w3.org/1999/xhtml">\n'

  for (const path of staticPaths) {
    for (const loc of locales) {
      xml += '  <url>\n'
      xml += `    <loc>${baseUrl}/${loc}${path}</loc>\n`
      for (const alt of locales) {
        xml += `    <xhtml:link rel="alternate" hreflang="${alt}" href="${baseUrl}/${alt}${path}" />\n`
      }
      xml += `    <xhtml:link rel="alternate" hreflang="x-default" href="${baseUrl}/ua${path}" />\n`
      xml += `    <priority>${path === '' ? '1.0' : '0.8'}</priority>\n`
      xml += `    <changefreq>daily</changefreq>\n`
      xml += '  </url>\n'
    }
  }

  for (const group of groups) {
    for (const loc of locales) {
      xml += '  <url>\n'
      xml += `    <loc>${baseUrl}/${loc}/groups/${group.slug}</loc>\n`
      for (const alt of locales) {
        xml += `    <xhtml:link rel="alternate" hreflang="${alt}" href="${baseUrl}/${alt}/groups/${group.slug}" />\n`
      }
      xml += `    <xhtml:link rel="alternate" hreflang="x-default" href="${baseUrl}/ua/groups/${group.slug}" />\n`
      xml += `    <lastmod>${group.updatedAt.toISOString().split('T')[0]}</lastmod>\n`
      xml += '    <priority>0.8</priority>\n'
      xml += '    <changefreq>weekly</changefreq>\n'
      xml += '  </url>\n'
    }
  }

  for (const org of organizers) {
    for (const loc of locales) {
      xml += '  <url>\n'
      xml += `    <loc>${baseUrl}/${loc}/organizers/${org.slug}</loc>\n`
      for (const alt of locales) {
        xml += `    <xhtml:link rel="alternate" hreflang="${alt}" href="${baseUrl}/${alt}/organizers/${org.slug}" />\n`
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
