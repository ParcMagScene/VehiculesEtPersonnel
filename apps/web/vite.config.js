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
    // Source maps pour le debugging production
    sourcemap: false, // [AUDIT FIX] Désactivé en production pour ne pas exposer le code source
    rollupOptions: {
      output: {
        manualChunks: {
          // Isoler les grosses librairies dans des chunks séparés
          'vendor-react': ['react', 'react-dom'],
          'vendor-pdf': ['pdfjs-dist'],
          'vendor-xlsx': ['xlsx'],
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
    allowedHosts: true,
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
    allowedHosts: ['magsav.duckdns.org', '.duckdns.org'],
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
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
