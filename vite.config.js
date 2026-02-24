import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    // Supprimer console.log et debugger en production
    minify: 'esbuild',
    target: 'es2020',
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
