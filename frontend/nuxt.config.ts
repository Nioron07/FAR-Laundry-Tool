// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: false },
  ssr: true, // Disable SSR for static generation
  modules: [
    '@nuxt/eslint',
    'vuetify-nuxt-module',
  ],

  app: {
    head: {
      link: [
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
      apiBase: process.env.BACKEND_API_URL || 'http://localhost:8080'
    }
  },
})