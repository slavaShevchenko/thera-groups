export default defineEventHandler((event) => {
  const config = useRuntimeConfig()
  const siteUrl = config.public.siteUrl as string

  const lines = [
    'User-agent: *',
    'Disallow: /*/groups/my$',
    'Disallow: /*/groups/new$',
    'Disallow: /*/groups/edit/',
    'Disallow: /*/groups/applications/',
    'Disallow: /*/applications/',
    'Disallow: /*/profile',
    'Disallow: /*/favorites',
    'Disallow: /*/notifications',
    'Disallow: /*/admin',
    'Disallow: /*/auth/',
    '',
    'Allow: /',
    '',
    `Sitemap: ${siteUrl}/sitemap.xml`,
  ]

  setResponseHeader(event, 'Content-Type', 'text/plain; charset=utf-8')
  return lines.join('\n')
})
