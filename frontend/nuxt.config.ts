// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: false },
  ssr: true,

  modules: [
    '@nuxt/eslint',
    'vuetify-nuxt-module',
    '@nuxtjs/seo',
  ],

  nitro: {
    preset: 'static',
    prerender: {
      crawlLinks: true,
      routes: [
        '/',
        '/forecast',
        '/schedule',
        '/contribute',
      ],
    },
  },

  site: {
    url: 'https://farlaundry.com',
    name: 'FAR Laundry Tool',
    description: 'Track laundry machine availability and plan optimal times at FAR residence halls',
    defaultLocale: 'en',
  },

  ogImage: {
    enabled: false,
  },

  sitemap: {
    enabled: true,
  },

  robots: {
    enabled: true,
  },

  app: {
    head: {
      htmlAttrs: {
        lang: 'en',
      },
      link: [
        { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' },
        { rel: 'apple-touch-icon', href: '/favicon.ico' },
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Oxanium:wght@200..800&display=swap' },
      ],
    },
  },

  vuetify: {
    moduleOptions: {
      ssrClientHints: {
        reloadOnFirstRequest: false,
      },
    },
    vuetifyOptions: {
      theme: {
        defaultTheme: 'dark',
        themes: {
          dark: {
            dark: true,
            colors: {
              primary: '#2196F3',
              secondary: '#424242',
              accent: '#FF4081',
              error: '#FF5252',
              info: '#2196F3',
              success: '#4CAF50',
              warning: '#FB8C00',
              background: '#121212',
              surface: '#1E1E1E',
            },
          },
        },
      },
    },
  },

  runtimeConfig: {
    public: {
      apiBase: process.env.ENVIRONMENT === 'DEV'
        ? 'http://localhost:8080'
        : 'https://far-laundry-tool-1047148175119.northamerica-northeast2.run.app'
    }
  },
})