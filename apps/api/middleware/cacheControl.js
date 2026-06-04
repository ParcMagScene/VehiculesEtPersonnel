// [PERF Phase 4.P] Middleware factory pour ajouter un header Cache-Control
// sur les endpoints de lecture stables (taxonomies, refs).
//
// Notes:
// - Tous nos endpoints sont derrière `authenticateToken` -> visibility = `private`
//   par défaut pour empêcher un proxy partagé de servir la réponse d'un user
//   à un autre. La réponse reste cachée par le navigateur du user.
// - On combine avec l'ETag généré automatiquement par Express sur res.json().
//   Si le client revalide après expiry (must-revalidate), il enverra
//   `If-None-Match` et l'API peut répondre 304 (économie réseau + déserialisation).
// - Ne pas appliquer sur les endpoints qui mutent l'état (POST/PUT/DELETE)
//   ni sur ceux qui dépendent de l'identité (sessions, /me, notifications).
//
// Usage:
//   app.get('/api/equipment-categories',
//     authenticateToken,
//     setCacheControl(3600),
//     (req, res) => { ... });

export function setCacheControl(maxAgeSeconds, { shared = false } = {}) {
  const visibility = shared ? 'public' : 'private';
  const value = `${visibility}, max-age=${maxAgeSeconds}, must-revalidate`;
  return function cacheControlMiddleware(_req, res, next) {
    res.set('Cache-Control', value);
    next();
  };
}

export default setCacheControl;
