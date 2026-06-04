// [P1-15] Extrait depuis apps/api/routes.js
// CLIENTS (DEPRECATED — utiliser /api/annuaire/clients)
// GET → conservé en lecture seule + headers Deprecation (sera supprimé)
// POST/PUT/DELETE → 410 Gone (aucun consommateur runtime côté apps)

import { browserRevalidate, cacheMiddleware, listCache } from './cache.js';
import db from './database.js';
import logger from './logger.js';

const CLIENTS_SUNSET = 'Wed, 31 Dec 2025 23:59:59 GMT';

export function setDeprecationHeaders(res, replacement) {
  res.setHeader('Deprecation', 'true');
  res.setHeader('Sunset', CLIENTS_SUNSET);
  if (replacement) res.setHeader('Link', `<${replacement}>; rel="successor-version"`);
}

function gone(replacement) {
  return (req, res) => {
    setDeprecationHeaders(res, replacement);
    logger.warn(
      `⛔ ${req.method} ${req.originalUrl} (legacy) → 410 Gone — utiliser ${replacement}`,
    );
    res.status(410).json({
      success: false,
      error: 'Endpoint supprimé',
      code: 'DEPRECATED_ENDPOINT',
      replacement,
    });
  };
}

export function setupClientsRoutes(app, authenticateToken, _requireAdmin) {
  app.get(
    '/api/clients',
    authenticateToken,
    browserRevalidate(),
    cacheMiddleware(listCache, () => 'clients', 60_000),
    (req, res) => {
      setDeprecationHeaders(res, '/api/annuaire/clients');
      logger.warn('⚠️  GET /api/clients (legacy) — migrer vers /api/annuaire/clients');
      try {
        const stmt = db.prepare('SELECT * FROM clients WHERE is_active = 1 OR is_active IS NULL');
        res.json(stmt.all());
      } catch (error) {
        logger.error(error);
        res.status(500).json({ success: false, error: 'Erreur serveur interne' });
      }
    },
  );

  app.post('/api/clients', authenticateToken, gone('/api/annuaire/clients'));
  app.put('/api/clients/:id', authenticateToken, gone('/api/annuaire/clients/:id'));
  app.delete('/api/clients/:id', authenticateToken, gone('/api/annuaire/clients/:id'));
}
