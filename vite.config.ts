import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
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
