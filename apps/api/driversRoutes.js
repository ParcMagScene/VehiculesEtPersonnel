// [P1-15] Extrait depuis apps/api/routes.js
// CONDUCTEURS (DEPRECATED — table supprimée Phase 6+)
// Gérés via table persons (license_types, skills Conduite*).
// GET /api/drivers conservé en compat (retourne []) avec headers Deprecation.

import { setDeprecationHeaders } from './clientsRoutes.js';

export function setupDriversRoutes(app, authenticateToken) {
  app.get('/api/drivers', authenticateToken, (_req, res) => {
    setDeprecationHeaders(res, '/api/annuaire/persons?role=driver');
    res.json([]);
  });
}
