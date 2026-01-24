import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto', // 🔥 FORCE Auto-Injection of SW
      devOptions: {
        enabled: true // Enable PWA in dev mode for testing
      },
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
      manifestFilename: 'manifest.json',
      manifest: {
        name: 'Azzahra Fashion Muslim',
        short_name: 'Azzahra',
        description: 'Pusat Fashion Muslim Terlengkap & Terpercaya',
        theme_color: '#0d0d0d',
        background_color: '#0d0d0d',
        display: 'standalone',
        display_override: ["window-controls-overlay", "minimal-ui"], // 🔥 Hardening display mode
        scope: '/',
        start_url: '/',
        orientation: 'portrait',
        prefer_related_applications: false, // 🔥 Force Web App over Native
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable' // 🔥 Restored maskable for compliance
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,ico,png,svg,jpg,jpeg}'], // 🔥 EXCLUDE HTML from precaching
        skipWaiting: true, // Force new SW to activate immediately
        clientsClaim: true, // Take control of all clients immediately
        cleanupOutdatedCaches: true, // Clean old caches
        navigateFallback: 'index.html', // Fallback for navigation requests
        navigateFallbackDenylist: [/^\/api/, /^\/clear-cache/], // Don't cache API and utility pages
        runtimeCaching: [
          // 🔥 CRITICAL: Navigation requests must use NetworkFirst for auth to work
          {
            urlPattern: ({ request }) => request.mode === 'navigate',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'pages-cache',
              networkTimeoutSeconds: 3,
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 5 // 5 minutes only
              }
            }
          },
          // 🔥 NEVER cache Firebase Auth API
          {
            urlPattern: /^https:\/\/.*\.firebaseapp\.com\/.*/i,
            handler: 'NetworkOnly'
          },
          {
            urlPattern: /^https:\/\/.*\.googleapis\.com\/identitytoolkit\/.*/i,
            handler: 'NetworkOnly'
          },
          {
            urlPattern: /^https:\/\/securetoken\.googleapis\.com\/.*/i,
            handler: 'NetworkOnly'
          },
          // Firebase Storage images can be cached aggressively
          {
            urlPattern: /^https:\/\/firebasestorage\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'firebase-storage-images',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24 * 30 // 30 days
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          }
        ]
      }
    })
  ],
  server: {
    host: '0.0.0.0',
    port: 5000,
    open: true,
    hmr: {
      overlay: true, // Show error overlay
    },
    headers: {
      // Stronger cache control for development
      'Cache-Control': 'no-cache, no-store, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
      'Surrogate-Control': 'no-store',
      'Last-Modified': new Date().toISOString()
    },
    fs: {
      // Ensure file system changes are detected immediately
      strict: false
    },
    proxy: {
      // RajaOngkir API proxy
      '/api/rajaongkir': {
        target: 'https://api.rajaongkir.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/rajaongkir/, ''),
        secure: true,
        headers: {
          'key': 'L3abavkD5358dc66be91f537G8MkpZHi'
        }
      }
    }
  },
  build: {
    target: 'es2015',
    minify: 'terser',
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          ui: ['lucide-react']
        }
      }
    }
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
});
