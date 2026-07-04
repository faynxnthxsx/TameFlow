// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  modules: [
    '@nuxtjs/tailwindcss',
    '@nuxtjs/supabase',
    '@pinia/nuxt',
    '@vueuse/nuxt',
    '@nuxtjs/i18n'
  ],

  tailwindcss: {
    cssPath: '~/assets/css/main.css'
  },

  supabase: {
    // Route protection is handled by our own middleware in Phase 1
    // (app/middleware/auth.global.ts), not the module's built-in redirect.
    redirectOptions: {
      login: '/login',
      callback: '/confirm',
      exclude: ['/**']
    }
  },

  i18n: {
    locales: [
      { code: 'en', name: 'English', file: 'en.json' },
      { code: 'th', name: 'ไทย', file: 'th.json' },
      { code: 'ja', name: '日本語', file: 'ja.json' }
    ],
    langDir: '../i18n/locales',
    defaultLocale: 'en',
    strategy: 'no_prefix',
    lazy: true
  }
})
