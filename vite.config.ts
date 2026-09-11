import { fileURLToPath, URL } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'
import { VitePWA } from 'vite-plugin-pwa'

const INK = '#1a1917'

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png'],
      manifest: {
        id: '/',
        scope: '/',
        start_url: '/',
        name: 'Word Matcher',
        short_name: 'Word Matcher',
        description: 'Adaptive Mandarin vocabulary drills for your phone.',
        display: 'standalone',
        orientation: 'portrait',
        lang: 'en',
        theme_color: INK,
        background_color: INK,
        categories: ['education'],
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icons/maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        navigateFallback: '/index.html',
        runtimeCaching: [
          {
            // Serve the word lists from cache so play works offline, then revalidate in
            // the background. CacheFirst would be wrong here: the URL is identical on
            // every build, so a returning player would keep whatever glosses and pinyin
            // they first loaded, and a data rebuild would never reach them. With
            // StaleWhileRevalidate the cost is one conditional request per list per
            // visit - a 304 from Firebase - and a rebuild lands on the next session.
            urlPattern: /\/data\/lists\/.*\.json$/,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'word-lists',
              expiration: {
                maxEntries: 24,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
            },
          },
        ],
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
  build: {
    target: 'es2022',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom'],
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['tests/unit/**/*.test.ts', 'tests/unit/**/*.test.tsx'],
    restoreMocks: true,
  },
})
