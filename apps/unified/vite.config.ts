import { defineConfig } from 'vitest/config';
import react           from '@vitejs/plugin-react';
import { VitePWA }     from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icon-192.svg', 'icon-512.svg'],
      manifest: {
        name:             'Reserti',
        short_name:       'Reserti',
        description:      'Rezerwacja biurek z beaconami NFC',
        theme_color:      '#B53578',
        background_color: '#09090f',
        display:          'standalone',
        start_url:        '/dashboard',
        scope:            '/',
        lang:             'pl',
        icons: [
          { src: '/icon-192.svg', sizes: '192x192', type: 'image/svg+xml', purpose: 'any' },
          { src: '/icon-512.svg', sizes: '512x512', type: 'image/svg+xml', purpose: 'any maskable' },
        ],
        categories: ['productivity', 'business'],
      },
      workbox: {
        skipWaiting: true,
        clientsClaim: true,
        globPatterns: ['**/*.{js,css,html,ico,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https?:\/\/.*\/api\//,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: { maxEntries: 50, maxAgeSeconds: 300 },
              networkTimeoutSeconds: 5,
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  server: { port: 3010, host: true },
  build:  { outDir: 'dist', sourcemap: false },
  test: {
    globals:     true,
    environment: 'jsdom',
    setupFiles:  ['src/__tests__/setup.ts'],
  },
});
