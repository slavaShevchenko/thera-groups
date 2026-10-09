import { buildHstsHeader } from './shared/utils/securityHeaders'

export default defineNuxtConfig({
  modules: ['@nuxt/eslint'],

  components: [
    {
      path: '~/components',
      pathPrefix: false,
    },
  ],

  devtools: { enabled: process.env.NODE_ENV !== 'production' },

  // https://nuxt.com/docs/api/configuration/nuxt-config
  app: {
    pageTransition: {
      name: 'page',
      mode: 'out-in',
    },
    head: {
      charset: 'utf-8',
      viewport: 'width=device-width, initial-scale=1',
      htmlAttrs: { lang: 'uk' },
      title: 'PsyGroup',
      meta: [
        { name: 'apple-mobile-web-app-title', content: 'PsyGroup' },
        { property: 'og:site_name', content: 'PsyGroup' },
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
    '~/assets/css/animations.css',
  ],

  runtimeConfig: {
    // Private values are deliberately empty here rather than `process.env.X`. Anything
    // assigned from the environment at this point is evaluated on the build machine and
    // baked into `.output`, so a rotated secret would keep serving the old one until the
    // next build — and the artifact itself would carry it. `resolveEnvValue()` in
    // server/utils/config.ts reads each of these at runtime, then falls back to the bare
    // environment name, so both `NUXT_RESEND_API_KEY` and `RESEND_API_KEY` work.
    databaseUrl: '',
    supabaseServiceRoleKey: '',
    supabaseAnonKey: '',
    resendApiKey: '',
    emailFrom: '',
    // Read only while the database has zero ADMIN rows — see server/utils/bootstrap.ts.
    adminEmail: '',
    adminPassword: '',

    // Public values stay build-time: the client bundle reads this same object and has no
    // environment to fall back to. Neither is a secret.
    public: {
      siteUrl: process.env.SITE_URL || 'http://localhost:3000',
      supabaseUrl: process.env.SUPABASE_URL,
    },
  },

  routeRules: {
    '/': { redirect: '/ua' },
    '/**': {
      headers: {
        'X-Frame-Options': 'DENY',
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
        'Strict-Transport-Security': buildHstsHeader(process.env),
      },
    },
  },

  sourcemap: { server: false, client: false },

  compatibilityDate: '2026-09-01',

  hooks: {
    // Nuxt registers its own nitro errorHandler — the one that renders app/error.vue —
    // only when none is configured, so setting `nitro.errorHandler` here would silently
    // replace it and degrade every SSR error page to Nitro's built-in one. Prepending
    // from the hook keeps both: ours answers uncaught Prisma failures on /api/*, and
    // Nuxt's still renders the error page for HTML requests.
    'nitro:config'(nitroConfig) {
      const prismaErrorHandler = '~~/server/utils/nitroErrorHandler'
      const existing = nitroConfig.errorHandler

      nitroConfig.errorHandler = existing
        ? [prismaErrorHandler, existing].flat()
        : prismaErrorHandler
    },
  },

  eslint: {
    config: {
      stylistic: true,
    },
  },
})
