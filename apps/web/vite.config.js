import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Le dossier public est à la racine du monorepo
  publicDir: '../../public',
  build: {
    // Supprimer console.log et debugger en production
    minify: 'esbuild',
    target: 'es2020',
    chunkSizeWarningLimit: 600,
    // Source maps pour le debugging production
    sourcemap: false, // [AUDIT FIX] Désactivé en production pour ne pas exposer le code source
    rollupOptions: {
      output: {
        manualChunks: {
          // Isoler les grosses librairies dans des chunks séparés
          'vendor-react': ['react', 'react-dom'],
          'vendor-pdf': ['pdfjs-dist'],
          'vendor-dates': ['date-fns'],
          'vendor-icons': ['lucide-react'],
          'vendor-qr': ['qrcode.react'],
        },
      },
    },
  },
  esbuild: {
    // En build de production, supprimer les console.log/debug (garder console.error/warn)
    drop: process.env.NODE_ENV === 'production' ? ['debugger'] : [],
    pure: process.env.NODE_ENV === 'production' ? ['console.log', 'console.debug', 'console.info'] : [],
  },
  server: {
    // MODE DEV — proxy vers le backend DEV sur port 3003
    host: '0.0.0.0',
    port: 5174,
    open: true,
    allowedHosts: ['localhost', '192.168.205.75', 'magsav.duckdns.org'],
    proxy: {
      '/api': {
        target: 'http://localhost:3003',
        changeOrigin: true
      }
    }
  },
  preview: {
    // MODE PROD — proxy vers le backend PROD sur port 3002
    host: '0.0.0.0',
    port: 4173,
    allowedHosts: ['localhost', '192.168.205.75', 'magsav.duckdns.org'],
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
      'Content-Security-Policy': [
        "default-src 'self'",
        "script-src 'self' https://accounts.google.com https://maps.googleapis.com",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net",
        "font-src 'self' https://fonts.gstatic.com https://cdn.jsdelivr.net data:",
        "img-src 'self' data: blob: https://*.googleapis.com https://*.gstatic.com",
        "connect-src 'self' https://*.googleapis.com https://accounts.google.com",
        "frame-src https://accounts.google.com",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
      ].join('; '),
    },
    proxy: {
      '/api': {
        target: 'http://localhost:3002',
        changeOrigin: true
      }
    }
  },
  optimizeDeps: {
    include: ['pdfjs-dist']
  },
  resolve: {
    alias: {
      'pdfjs-dist/build/pdf.worker.min.mjs': 'pdfjs-dist/build/pdf.worker.mjs'
    }
  }
})
