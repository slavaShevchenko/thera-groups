export default defineNuxtConfig({
  modules: ['@nuxt/eslint', '@nuxt/icon'],

  components: [
    {
      path: '~/components',
      pathPrefix: false,
    },
  ],
  devtools: { enabled: true },

  css: ['~/assets/css/variables.css'],
  compatibilityDate: '2024-11-01',

  eslint: {
    config: {
      stylistic: true,
    },
  },

  icon: {
    serverBundle: 'local',
  },
})
