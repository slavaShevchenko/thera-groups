export default defineNuxtConfig({
  modules: ['@nuxt/eslint'],

  components: [
    {
      path: '~/components',
      pathPrefix: false,
    },
  ],
  devtools: { enabled: true },

  // https://nuxt.com/docs/api/configuration/nuxt-config
  app: {
    pageTransition: {
      name: 'page',
      mode: 'out-in',
    },
    head: {
      htmlAttrs: { lang: 'uk' },
      charset: 'utf-8',
      viewport: 'width=device-width, initial-scale=1',
      title: 'TheraGroups — Каталог психотерапевтичних груп',
      meta: [
        { name: 'apple-mobile-web-app-title', content: 'PsyGroup' },
        { name: 'description', content: 'Знайдіть терапевтичну групу для підтримки, розвитку та зцілення.' },
        { property: 'og:site_name', content: 'TheraGroups' },
        { property: 'og:type', content: 'website' },
        { name: 'twitter:card', content: 'summary_large_image' },
      ],
      link: [
        { rel: 'icon', type: 'image/png', href: '/favicon-96x96.png', sizes: '96x96' },
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
        { rel: 'shortcut icon', href: '/favicon.ico' },
        { rel: 'apple-touch-icon', sizes: '180x180', href: '/apple-touch-icon.png' },
        { rel: 'manifest', href: '/site.webmanifest' },
      ],
    },
  },

  css: [
    '~/assets/css/fonts.css',
    '~/assets/css/variables.css',
  ],
  compatibilityDate: '2024-11-01',

  eslint: {
    config: {
      stylistic: true,
    },
  },
})
