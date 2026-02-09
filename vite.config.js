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
    host: '0.0.0.0',
    port: 5174,
    open: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3002',
        changeOrigin: true
      }
    }
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
    allowedHosts: ['magsav.duckdns.org', '.duckdns.org'],
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
