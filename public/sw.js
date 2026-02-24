// Service Worker eM@g — v45 (minimal, no asset caching)
// Les assets JS/CSS ont des hashes Vite → le cache HTTP navigateur suffit.
// Le SW ne sert qu'au mode offline pour la page d'accueil et le manifest.
const CACHE_NAME = 'emag-cache-v45';
const PRECACHE_URLS = [
  '/',
  '/manifest.json',
  '/Logos/LogoEmag.png',
];

// Installation : pré-cache uniquement les ressources essentielles
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

// Activation : supprimer TOUS les anciens caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(cacheNames.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
    )
  );
  self.clients.claim();
});

// Stratégie : Network-only pour tout sauf les URLs pré-cachées (offline fallback)
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // API → toujours réseau, pas d'interception
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/api')) {
    return;
  }

  // Assets JS/CSS/images avec hash Vite → laisser le navigateur gérer (pas d'interception)
  if (url.pathname.startsWith('/assets/')) {
    return;
  }

  // Pour le reste (/, /manifest.json, etc.) : network-first avec fallback cache offline
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Mettre à jour le cache pour les URLs pré-cachées
        if (response.status === 200 && PRECACHE_URLS.includes(url.pathname)) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
