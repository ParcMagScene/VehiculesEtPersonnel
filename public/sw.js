/* eslint-disable no-restricted-globals, no-undef */
/**
 * eM@g Service Worker — [PERF Phase 4.K]
 *
 * Stratégies de cache :
 *  - /assets/<name>-<HASH>.{js,css,woff2,ttf,svg,png,webp} → cache-first
 *    (immuables, le hash change à chaque build → invalidation gratuite)
 *  - /icons/, /Logos/, /Photos/, /avatars/, /display-logo/, /display-media/,
 *    /radio-logos/, /manifest.json → stale-while-revalidate
 *    (servi instantanément depuis le cache, refetch en arrière-plan)
 *  - HTML / navigations (mode=navigate) → network-first, fallback cache shell
 *    (l'utilisateur reçoit toujours le dernier index.html quand le réseau est OK)
 *  - /api/, /socket.io/, /ws/, /sse/, requêtes non-GET → network passthrough
 *  - Cross-origin → passthrough (pas d'interception)
 *
 * Versionnage : BUILD_VERSION est injecté au build par
 *   apps/web/scripts/inject-sw-version.mjs (remplace __BUILD_VERSION__).
 *   À chaque deploy, la version change → activate purge les anciens caches.
 *
 * Désactivation : pour tuer le SW en urgence, redéployer un /sw.js
 *   contenant uniquement `self.registration.unregister();` puis recharger.
 */

const BUILD_VERSION = '__BUILD_VERSION__';
const CACHE_ASSETS = `emag-assets-${BUILD_VERSION}`;
const CACHE_IMAGES = `emag-images-${BUILD_VERSION}`;
const CACHE_SHELL = `emag-shell-${BUILD_VERSION}`;
const ALL_CACHES = [CACHE_ASSETS, CACHE_IMAGES, CACHE_SHELL];

// Plafond simple par cache pour éviter croissance illimitée des images.
const MAX_IMAGES_ENTRIES = 200;

// ─── Helpers ──────────────────────────────────────────────────────────────

function isHashedAsset(url) {
  // /assets/PlanningPanel-DYyH5a4J.js, /assets/index-xxxxxx.css, etc.
  return (
    url.pathname.startsWith('/assets/') &&
    /-[a-zA-Z0-9_]{6,}\.(js|css|woff2?|ttf|svg|png|jpg|jpeg|webp)$/.test(url.pathname)
  );
}

function isStaticImage(url) {
  const p = url.pathname;
  return (
    p === '/manifest.json' ||
    p.startsWith('/icons/') ||
    p.startsWith('/Logos/') ||
    p.startsWith('/Photos/') ||
    p.startsWith('/avatars/') ||
    p.startsWith('/display-logo/') ||
    p.startsWith('/display-media/') ||
    p.startsWith('/radio-logos/')
  );
}

function isApiOrRealtime(url) {
  const p = url.pathname;
  return (
    p.startsWith('/api/') ||
    p.startsWith('/socket.io/') ||
    p.startsWith('/ws/') ||
    p.startsWith('/sse/')
  );
}

async function trimCache(cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length <= maxEntries) return;
  // Supprime les plus anciennes (FIFO simple).
  const excess = keys.length - maxEntries;
  for (let i = 0; i < excess; i++) {
    await cache.delete(keys[i]);
  }
}

// ─── install : précache shell minimal ─────────────────────────────────────

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_SHELL);
      // Précache minimal — juste de quoi afficher un fallback offline.
      // On NE précache PAS index.html ici (récupéré au premier navigate).
      try {
        await cache.addAll(['/icons/favicon-32x32.png', '/manifest.json']);
      } catch (_err) {
        // Pas bloquant : ressources manquantes ne doivent pas empêcher l'install.
      }
      await self.skipWaiting();
    })(),
  );
});

// ─── activate : purge anciens caches + claim ──────────────────────────────

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((n) => n.startsWith('emag-') && !ALL_CACHES.includes(n))
          .map((n) => caches.delete(n)),
      );
      await self.clients.claim();
    })(),
  );
});

// ─── message : skip waiting forcé (déclenché côté page) ────────────────────

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// ─── fetch : routage par stratégie ─────────────────────────────────────────

self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Bypass total : non-GET, cross-origin, API/realtime.
  if (req.method !== 'GET') return;
  let url;
  try {
    url = new URL(req.url);
  } catch (_e) {
    return;
  }
  if (url.origin !== self.location.origin) return;
  if (isApiOrRealtime(url)) return;

  // 1) Assets hashés → cache-first.
  if (isHashedAsset(url)) {
    event.respondWith(
      caches.open(CACHE_ASSETS).then(async (cache) => {
        const hit = await cache.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res && res.ok) cache.put(req, res.clone());
        return res;
      }),
    );
    return;
  }

  // 2) Images / icônes statiques → stale-while-revalidate.
  if (isStaticImage(url)) {
    event.respondWith(
      caches.open(CACHE_IMAGES).then(async (cache) => {
        const hit = await cache.match(req);
        const network = fetch(req)
          .then((res) => {
            if (res && res.ok) {
              cache.put(req, res.clone());
              trimCache(CACHE_IMAGES, MAX_IMAGES_ENTRIES);
            }
            return res;
          })
          .catch(() => hit);
        return hit || network;
      }),
    );
    return;
  }

  // 3) Navigations HTML → network-first, fallback cache shell.
  if (req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html')) {
    event.respondWith(
      (async () => {
        try {
          const res = await fetch(req);
          if (res && res.ok) {
            const cache = await caches.open(CACHE_SHELL);
            cache.put(req, res.clone());
          }
          return res;
        } catch (_err) {
          const cache = await caches.open(CACHE_SHELL);
          const hit = await cache.match(req);
          if (hit) return hit;
          const fallback = await cache.match('/');
          if (fallback) return fallback;
          return new Response('Offline', { status: 503, statusText: 'Offline' });
        }
      })(),
    );
    return;
  }

  // 4) Autre (par défaut) → passthrough réseau.
});
