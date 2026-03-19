// Désenregistrer tous les Service Workers et vider tous les caches
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(function(regs) {
    regs.forEach(function(r) { r.unregister(); });
  });
}
if ('caches' in window) {
  caches.keys().then(function(names) {
    names.forEach(function(n) { caches.delete(n); });
  });
}
