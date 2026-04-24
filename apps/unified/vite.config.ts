import { defineConfig } from 'vitest/config';
import react           from '@vitejs/plugin-react';
import { VitePWA }     from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      strategies:   'injectManifest',
      srcDir:       'src',
      filename:     'sw.ts',
      includeAssets: ['favicon.svg', 'icon-192.svg', 'icon-512.svg', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png'],
      manifest: {
        name:             'Reserti',
        short_name:       'Reserti',
        description:      'Rezerwacja biurek z beaconami NFC',
        theme_color:      '#9C2264',
        background_color: '#09090f',
        display:          'standalone',
        start_url:        '/dashboard',
        scope:            '/',
        lang:             'pl',
        icons: [
          // PNG first — wymagane przez starszy Android i Chrome for Android
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png',     purpose: 'any' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png',     purpose: 'any maskable' },
          // SVG jako fallback dla nowoczesnych przeglądarek (obsługuje skalowanie)
          { src: '/icon-192.svg', sizes: '192x192', type: 'image/svg+xml', purpose: 'any' },
          { src: '/icon-512.svg', sizes: '512x512', type: 'image/svg+xml', purpose: 'any maskable' },
        ],
        categories: ['productivity', 'business'],
        shortcuts: [
          {
            name: 'Mapa biurek',
            short_name: 'Mapa',
            url: '/map',
            icons: [{ src: '/icon-192.svg', sizes: '192x192' }],
          },
          {
            name: 'Moje rezerwacje',
            short_name: 'Rezerwacje',
            url: '/my-reservations',
            icons: [{ src: '/icon-192.svg', sizes: '192x192' }],
          },
        ],
      },
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,ico,svg,woff2}'],
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
