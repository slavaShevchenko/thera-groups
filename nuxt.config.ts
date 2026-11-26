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
      script: [
        // Google Consent Mode v2 defaults — must run before any tags load.
        // Denies all by default; the cookie banner updates to 'granted' on accept.
        // When GA4/GTM is added, it will respect these defaults automatically.
        {
          innerHTML: `
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            window.gtag = gtag;
            gtag('consent', 'default', {
              'ad_storage': 'denied',
              'ad_user_data': 'denied',
              'ad_personalization': 'denied',
              'analytics_storage': 'denied',
              'wait_for_update': 500
            });
          `,
          type: 'text/javascript',
        },
        // Cloudflare Turnstile — invisible captcha for spam protection
        {
          src: 'https://challenges.cloudflare.com/turnstile/v0/api.js',
          async: true,
        },
        {
          'src': 'https://analytics.ahrefs.com/analytics.js',
          'data-key': 'ogI+U6PxLtYztlB4rFyMwA',
          'async': true,
        },
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
    // Supabase Storage bucket for organizer avatars. Not a secret, but resolved at request
    // time like the rest so renaming a bucket is a restart rather than a rebuild. Empty here
    // means `useServerConfig()` applies DEFAULT_ORGANIZER_AVATARS_BUCKET — see
    // docs/deployment.md#storage-buckets, because no migration creates the bucket itself.
    storageBucketOrganizerAvatars: '',
    resendApiKey: '',
    emailFrom: '',
    // Cloudflare Turnstile secret for server-side token verification.
    turnstileSecretKey: '',
    // Read only while the database has zero ADMIN rows — see server/utils/bootstrap.ts.
    adminEmail: '',
    adminPassword: '',

    // Public values stay build-time: the client bundle reads this same object and has no
    // environment to fall back to. Neither is a secret.
    public: {
      siteUrl: process.env.SITE_URL || 'http://localhost:3000',
      supabaseUrl: process.env.SUPABASE_URL,
      // Cloudflare Turnstile site key for client-side widget. Not a secret.
      turnstileSiteKey: process.env.TURNSTILE_SITE_KEY || '',
    },
  },

  routeRules: {
    '/': { redirect: '/ua' },
    /**
     * The one group published while `POST /api/groups` still slugified the literal
     * `'new-group'` — see `createGroupSchema` for why it now requires a title. The row was
     * renamed in place, but the old address is already inside two sent emails and possibly in
     * the index, so it 301s instead of 404ing. `new-group` can never be reissued (every group
     * slug now carries a random suffix), so these two lines are safe to delete once analytics
     * stop showing hits on them.
     */
    '/ua/groups/new-group': {
      redirect: { to: '/ua/groups/ochna-interviziina-hrupa-eagt-u-krakovi-eb8b30', statusCode: 301 },
    },
    '/en/groups/new-group': {
      redirect: { to: '/en/groups/ochna-interviziina-hrupa-eagt-u-krakovi-eb8b30', statusCode: 301 },
    },
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

  nitro: {
    vercel: {
      functions: {
        /**
         * Room for the mail a request now waits on.
         *
         * Every `sendEmail` is awaited — see the contract in `server/services/email/index.ts`
         * for why a detached one is dropped on this runtime — so the provider round-trip is
         * part of the request. Vercel's default ceiling is 10s and `transport.ts` alone can
         * spend up to 35s on one message (3 attempts × 10s timeout + 1s/4s backoff), which
         * would kill the function mid-send and lose the response along with the email. 60s
         * is the maximum the Hobby plan allows.
         *
         * This bounds the common case, not the worst one. A degraded Resend costs up to 35s
         * per message, so `EMAIL_FANOUT_BUDGET_MS` in `server/utils/notifications.ts` stops a
         * group-cancellation fan-out at 40s instead of letting its second batch run into this
         * ceiling. Being killed mid-flight is the outcome worth avoiding: it loses the HTTP
         * response *and* every letter not yet started, and a letter that never started never
         * called `sendEmail`, so it leaves no `EmailEvent` row to show for itself either.
         *
         * What is attempted stays visible — `sendEmail` never throws and records its outcome
         * in `EmailEvent`, and the count of recipients a budget cut off goes to the function
         * log. A durable fix is a queue, not a longer timeout.
         */
        maxDuration: 60,
      },
    },
  },

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
