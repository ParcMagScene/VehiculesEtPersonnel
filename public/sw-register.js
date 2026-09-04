/**
 * eM@g — Enregistrement Service Worker [PERF Phase 4.K]
 *
 * Remplace l'ancien sw-cleanup.js. Enregistre /sw.js, recheck les updates
 * au focus de l'onglet, et déclenche un reload contrôlé quand un nouveau SW
 * a pris le contrôle (évite de servir un HTML neuf avec d'anciens chunks).
 *
 * Kill switch : si on veut désactiver le SW sans redéployer, taper dans la
 * console : `navigator.serviceWorker.getRegistrations().then(rs=>rs.forEach(r=>r.unregister()))`
 * puis recharger.
 */
(function () {
  if (!('serviceWorker' in navigator)) return;

  var reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', function () {
    if (reloaded) return;
    reloaded = true;
    window.location.reload();
  });

  function notifyUpdate() {
    try {
      window.dispatchEvent(new CustomEvent('emag-sw-update-available'));
    } catch (_) {
      /* noop */
    }
  }

  window.addEventListener('load', function () {
    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then(function (reg) {
        document.addEventListener('visibilitychange', function () {
          if (document.visibilityState === 'visible') {
            reg.update().catch(function () {});
          }
        });
        if (reg.waiting) {
          // Un nouveau SW attend déjà : on prévient l'UI et on lance skipWaiting.
          notifyUpdate();
          reg.waiting.postMessage({ type: 'SKIP_WAITING' });
        }
        reg.addEventListener('updatefound', function () {
          var sw = reg.installing;
          if (!sw) return;
          sw.addEventListener('statechange', function () {
            if (sw.state === 'installed' && navigator.serviceWorker.controller) {
              notifyUpdate();
              sw.postMessage({ type: 'SKIP_WAITING' });
            }
          });
        });
      })
      .catch(function (err) {
        // eslint-disable-next-line no-console
        console.warn('[sw-register] échec enregistrement', err && err.message);
      });
  });
})();
