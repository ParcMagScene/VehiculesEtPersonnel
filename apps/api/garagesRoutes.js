// [P1-15] Extrait depuis apps/api/routes.js — GARAGES

import { cacheMiddleware, listCache } from './cache.js';
import db, { addToHistory } from './database.js';
import logger from './logger.js';

export function setupGaragesRoutes(app, authenticateToken, requireAdmin) {
  app.get(
    '/api/garages',
    authenticateToken,
    cacheMiddleware(listCache, () => 'garages', 60_000),
    (req, res) => {
      try {
        const stmt = db.prepare('SELECT * FROM garages');
        const garages = stmt.all();
        res.json(garages);
      } catch (error) {
        logger.error(error);
        res.status(500).json({ success: false, error: 'Erreur serveur interne' });
      }
    },
  );

  app.post('/api/garages', authenticateToken, (req, res) => {
    try {
      const garage = req.body;
      const stmt = db.prepare(`
        INSERT INTO garages (name, address, phone, email, created_by, modified_by)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      const result = stmt.run(
        garage.name,
        garage.address,
        garage.phone,
        garage.email,
        req.user.id,
        req.user.id,
      );

      addToHistory('garage', result.lastInsertRowid, 'created', garage, req.user.id, req.user.name);

      res.status(201).json({ success: true, id: result.lastInsertRowid });
    } catch (error) {
      logger.error(error);
      res.status(500).json({ success: false, error: 'Erreur serveur interne' });
    }
  });

  app.put('/api/garages/:id', authenticateToken, (req, res) => {
    try {
      // Vérification existence (cf. AUDIT-MUTATIONS-BACKEND-2026-05-18 §4.1)
      const exists = db.prepare('SELECT id FROM garages WHERE id = ?').get(req.params.id);
      if (!exists) return res.status(404).json({ success: false, error: 'Garage non trouvé' });

      const garage = req.body;
      const stmt = db.prepare(`
        UPDATE garages 
        SET name = ?, address = ?, phone = ?, email = ?, modified_by = ?, modified_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `);

      stmt.run(garage.name, garage.address, garage.phone, garage.email, req.user.id, req.params.id);

      addToHistory('garage', req.params.id, 'updated', garage, req.user.id, req.user.name);

      res.json({ success: true });
    } catch (error) {
      logger.error(error);
      res.status(500).json({ success: false, error: 'Erreur serveur interne' });
    }
  });

  app.delete('/api/garages/:id', authenticateToken, requireAdmin, (req, res) => {
    try {
      // Vérification existence (cf. AUDIT-MUTATIONS-BACKEND-2026-05-18 §4.1)
      const result = db.prepare('DELETE FROM garages WHERE id = ?').run(req.params.id);
      if (result.changes === 0)
        return res.status(404).json({ success: false, error: 'Garage non trouvé' });

      addToHistory('garage', req.params.id, 'deleted', null, req.user.id, req.user.name);

      res.json({ success: true });
    } catch (error) {
      logger.error(error);
      res.status(500).json({ success: false, error: 'Erreur serveur interne' });
    }
  });
}
