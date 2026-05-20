// [P1-15] Extrait depuis apps/api/routes.js — LIEUX

import { cacheMiddleware, listCache } from './cache.js';
import db, { addToHistory } from './database.js';
import logger from './logger.js';

function normalizeLocationText(value) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ');
}

function normalizeLocationPayload(location) {
  return {
    name: normalizeLocationText(location?.name),
    address: normalizeLocationText(location?.address),
    type: normalizeLocationText(location?.type) || 'Salle de spectacle',
    place_id: normalizeLocationText(location?.place_id),
    lat: location?.lat ?? null,
    lng: location?.lng ?? null,
  };
}

function findExistingLocationDuplicate(location, excludedId = null) {
  const normalized = normalizeLocationPayload(location);
  if (!normalized.name) return null;

  return db
    .prepare(
      `SELECT id
         FROM locations
        WHERE LOWER(TRIM(name)) = LOWER(TRIM(?))
          AND LOWER(TRIM(COALESCE(type, 'Salle de spectacle'))) = LOWER(TRIM(?))
          AND (? IS NULL OR id != ?)
          AND (
            (? != '' AND LOWER(TRIM(COALESCE(place_id, ''))) = LOWER(TRIM(?)))
            OR (? != '' AND LOWER(TRIM(COALESCE(address, ''))) = LOWER(TRIM(?)))
            OR (? IS NOT NULL AND ? IS NOT NULL AND lat = ? AND lng = ?)
          )
        LIMIT 1`,
    )
    .get(
      normalized.name,
      normalized.type,
      excludedId,
      excludedId,
      normalized.place_id,
      normalized.place_id,
      normalized.address,
      normalized.address,
      normalized.lat,
      normalized.lng,
      normalized.lat,
      normalized.lng,
    );
}

export function setupLocationsRoutes(app, authenticateToken, requireAdmin) {
  app.get(
    '/api/locations',
    authenticateToken,
    cacheMiddleware(listCache, () => 'locations', 60_000),
    (req, res) => {
      try {
        const stmt = db.prepare('SELECT * FROM locations');
        const locations = stmt.all();
        res.json(locations);
      } catch (error) {
        logger.error(error);
        res.status(500).json({ success: false, error: 'Erreur serveur interne' });
      }
    },
  );

  app.post('/api/locations', authenticateToken, (req, res) => {
    try {
      const location = normalizeLocationPayload(req.body);

      const existing = findExistingLocationDuplicate(location);
      if (existing) {
        return res.status(409).json({ success: false, error: 'Un lieu équivalent existe déjà' });
      }

      const stmt = db.prepare(`
        INSERT INTO locations (name, address, lat, lng, place_id, type, created_by, modified_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const result = stmt.run(
        location.name,
        location.address,
        location.lat,
        location.lng,
        location.place_id,
        location.type || 'Salle de spectacle',
        req.user.id,
        req.user.id,
      );

      listCache.invalidate('locations');
      addToHistory(
        'location',
        result.lastInsertRowid,
        'created',
        location,
        req.user.id,
        req.user.name,
      );

      // Renvoyer l'objet complet
      const createdLocation = {
        id: result.lastInsertRowid,
        name: location.name,
        address: location.address,
        lat: location.lat,
        lng: location.lng,
        place_id: location.place_id,
        type: location.type || 'Salle de spectacle',
      };

      res.status(201).json(createdLocation);
    } catch (error) {
      logger.error(error);
      res.status(500).json({ success: false, error: 'Erreur serveur interne' });
    }
  });

  app.put('/api/locations/:id', authenticateToken, (req, res) => {
    try {
      // Vérification existence (cf. AUDIT-MUTATIONS-BACKEND-2026-05-18 §4.1)
      const exists = db.prepare('SELECT id FROM locations WHERE id = ?').get(req.params.id);
      if (!exists) return res.status(404).json({ success: false, error: 'Lieu non trouvé' });

      const location = normalizeLocationPayload(req.body);
      const existing = findExistingLocationDuplicate(location, Number(req.params.id));
      if (existing) {
        return res.status(409).json({ success: false, error: 'Un lieu équivalent existe déjà' });
      }

      const stmt = db.prepare(`
        UPDATE locations 
        SET name = ?, address = ?, lat = ?, lng = ?, place_id = ?, type = ?, modified_by = ?, modified_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `);

      stmt.run(
        location.name,
        location.address,
        location.lat,
        location.lng,
        location.place_id,
        location.type || 'Salle de spectacle',
        req.user.id,
        req.params.id,
      );

      listCache.invalidate('locations');
      addToHistory('location', req.params.id, 'updated', location, req.user.id, req.user.name);

      // Renvoyer l'objet complet
      const updatedLocation = {
        id: parseInt(req.params.id),
        name: location.name,
        address: location.address,
        lat: location.lat,
        lng: location.lng,
        place_id: location.place_id,
        type: location.type || 'Salle de spectacle',
      };

      res.json(updatedLocation);
    } catch (error) {
      logger.error(error);
      res.status(500).json({ success: false, error: 'Erreur serveur interne' });
    }
  });

  app.delete('/api/locations/:id', authenticateToken, requireAdmin, (req, res) => {
    try {
      // Vérification existence (cf. AUDIT-MUTATIONS-BACKEND-2026-05-18 §4.1)
      const result = db.prepare('DELETE FROM locations WHERE id = ?').run(req.params.id);
      if (result.changes === 0)
        return res.status(404).json({ success: false, error: 'Lieu non trouvé' });

      listCache.invalidate('locations');
      addToHistory('location', req.params.id, 'deleted', null, req.user.id, req.user.name);

      res.json({ success: true });
    } catch (error) {
      logger.error(error);
      res.status(500).json({ success: false, error: 'Erreur serveur interne' });
    }
  });
}
