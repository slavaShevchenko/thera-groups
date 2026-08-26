export default defineNuxtConfig({
  modules: ['@nuxt/eslint'],

  components: [
    {
      path: '~/components',
      pathPrefix: false,
    },
  ],
  devtools: { enabled: true },

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
        { name: 'description', content: 'Знайдіть терапевтичну групу для підтримки, розвитку та зцілення.' },
        { property: 'og:site_name', content: 'TheraGroups' },
        { property: 'og:type', content: 'website' },
        { name: 'twitter:card', content: 'summary_large_image' },
      ],
      link: [
        { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' },
        { rel: 'manifest', href: '/manifest.json' },
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
