import { defineConfig } from 'vite';
import react           from '@vitejs/plugin-react';
import { VitePWA }     from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icon-192.svg', 'icon-512.svg'],

      // Manifest — metadata aplikacji webowej
      manifest: {
        name:             'Reserti',
        short_name:       'Reserti',
        description:      'Rezerwacja biurek z beaconami NFC · Reserti IoT',
        theme_color:      '#B53578',
        background_color: '#09090f',
        display:          'standalone',
        orientation:      'portrait-primary',
        start_url:        '/dashboard',
        scope:            '/',
        lang:             'pl',
        icons: [
          {
            src:   '/icon-192.svg',
            sizes: '192x192',
            type:  'image/svg+xml',
            purpose: 'any',
          },
          {
            src:   '/icon-512.svg',
            sizes: '512x512',
            type:  'image/svg+xml',
            purpose: 'any maskable',
          },
        ],
        shortcuts: [
          {
            name:      'Mapa biurek',
            short_name:'Mapa',
            url:       '/map',
            icons:     [{ src: '/icon-192.svg', sizes: '192x192' }],
          },
          {
            name:      'Moje rezerwacje',
            short_name:'Rezerwacje',
            url:       '/my-reservations',
            icons:     [{ src: '/icon-192.svg', sizes: '192x192' }],
          },
        ],
        categories: ['productivity', 'business'],
      },

      // Workbox — strategia cache
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,svg,woff2}'],

        runtimeCaching: [
          // API — Network First (dane zawsze świeże)
          {
            urlPattern: /^https?:\/\/.*\/api\//,
            handler:    'NetworkFirst',
            options: {
              cacheName:       'api-cache',
              expiration:      { maxEntries: 50, maxAgeSeconds: 300 },
              networkTimeoutSeconds: 5,
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // Fonty Google — Cache First
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\//,
            handler:    'CacheFirst',
            options: {
              cacheName:  'google-fonts',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],

        // Nie cachuj endpointów auth — zawsze online
        navigateFallback:              '/index.html',
        navigateFallbackDenylist:      [/^\/api\//, /^\/auth\//],
        skipWaiting:                   true,
        clientsClaim:                  true,
      },

      // Tryb development — nie blokuj HMR
      devOptions: {
        enabled: false,
      },
    }),
  ],

  server: {
    port: 3010,
    proxy: { '/api': { target: 'http://localhost:3000', changeOrigin: true } },
  },
});
