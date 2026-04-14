import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { existsSync } from 'fs'
import { join } from 'path'

// Plugin : redirection auto quand le navigateur demande un asset périmé (ancien hash)
function staleAssetReload() {
  const distAssets = join(import.meta.dirname, 'dist', 'assets');
  return {
    name: 'stale-asset-reload',
    configurePreviewServer(server) {
      server.middlewares.use((req, res, next) => {
        // Uniquement pour les fichiers /assets/ avec hash (ex: PlanningPanel-DYyH5a4J.js)
        if (req.url?.startsWith('/assets/') && /-[a-zA-Z0-9_]{6,}\.(js|css)$/.test(req.url)) {
          const filePath = join(distAssets, req.url.replace('/assets/', ''));
          if (!existsSync(filePath)) {
            if (req.url.endsWith('.js')) {
              // Forcer un rechargement complet de la page pour obtenir le nouveau index.html
              res.writeHead(200, { 'Content-Type': 'application/javascript', 'Cache-Control': 'no-store' });
              res.end('window.location.reload();');
            } else {
              res.writeHead(404, { 'Content-Type': 'text/plain' });
              res.end('Asset outdated');
            }
            return;
          }
        }
        next();
      });
    },
  }
}

// Plugin : headers de cache intelligents (HTML = no-cache, assets hashés = immutable)
function smartCacheHeaders() {
  return {
    name: 'smart-cache-headers',
    configurePreviewServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url || '';
        const origSetHeader = res.setHeader.bind(res);
        res.setHeader = (name, value) => {
          if (name.toLowerCase() === 'cache-control') {
            // Assets avec hash → cache longue durée (le hash change à chaque build)
            if (url.startsWith('/assets/') && /-[a-zA-Z0-9_]{6,}\.(js|css|woff2?|ttf|svg|png|jpg|webp)$/.test(url)) {
              return origSetHeader(name, 'public, max-age=31536000, immutable');
            }
            // HTML et autres → pas de cache
            return origSetHeader(name, 'no-cache, no-store, must-revalidate');
          }
          return origSetHeader(name, value);
        };
        next();
      });
    },
  }
}

export default defineConfig(({ mode }) => ({
  plugins: [react(), staleAssetReload(), smartCacheHeaders()],
  // Le dossier public est à la racine du monorepo
  publicDir: '../../public',
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.js',
    css: false,
  },
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
    // [PHASE 5] Conditionné par le mode Vite (pas process.env.NODE_ENV)
    // vite build → mode='production', vite dev → mode='development'
    drop: mode === 'production' ? ['debugger'] : [],
    pure: mode === 'production' ? ['console.log', 'console.debug', 'console.info'] : [],
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
    allowedHosts: true,
    headers: {
      'Pragma': 'no-cache',
      'Expires': '0',
      'Content-Security-Policy': [
        "default-src 'self'",
        "script-src 'self' https://accounts.google.com https://maps.googleapis.com",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net",
        "font-src 'self' https://fonts.gstatic.com https://cdn.jsdelivr.net data:",
        "img-src 'self' data: blob: https://*.googleapis.com https://*.gstatic.com",
        "connect-src 'self' https://*.googleapis.com https://accounts.google.com",
        "frame-src 'self' blob: https://accounts.google.com",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
      ].join('; '),
    },
    proxy: {
      '/api': {
        target: 'https://localhost:3443',
        changeOrigin: true,
        secure: false
      }
    }
  },
  optimizeDeps: {
    include: ['pdfjs-dist']
  },
  resolve: {
    alias: {
      '@': join(import.meta.dirname, 'src'),
      'pdfjs-dist/build/pdf.worker.min.mjs': 'pdfjs-dist/build/pdf.worker.mjs'
    }
  }
}))
