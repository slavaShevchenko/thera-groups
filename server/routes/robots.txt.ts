export default defineEventHandler((event) => {
  const config = useRuntimeConfig()
  const siteUrl = config.public.siteUrl as string

  // Everything below is an authenticated surface. `/privacy` and `/terms` are deliberately
  // not here even though they are `noindex` and absent from the sitemap: a crawler that is
  // refused the page never sees the meta tag, so it is free to index the URL anyway. The
  // tag only works on a page that is allowed to be fetched.
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
