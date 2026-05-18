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

// ============ CLIENTS (DEPRECATED — utiliser /api/annuaire/clients) ============
// GET → conservé en lecture seule + headers Deprecation (sera supprimé)
// POST/PUT/DELETE → 410 Gone (aucun consommateur runtime côté apps)

const CLIENTS_SUNSET = 'Wed, 31 Dec 2025 23:59:59 GMT';

function setDeprecationHeaders(res, replacement) {
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

// ============ CONDUCTEURS (DEPRECATED — table supprimée Phase 6+) ============
// Gérés via table persons (license_types, skills Conduite*).
// GET /api/drivers conservé en compat (retourne []) avec headers Deprecation.

export function setupDriversRoutes(app, authenticateToken) {
  app.get('/api/drivers', authenticateToken, (_req, res) => {
    setDeprecationHeaders(res, '/api/annuaire/persons?role=driver');
    res.json([]);
  });
}

// ============ LIEUX ============

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

      res.json(createdLocation);
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

// ============ GARAGES ============

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

      res.json({ success: true, id: result.lastInsertRowid });
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

// ============ CONFIGURATION ============

export function setupConfigRoutes(app, authenticateToken, requireAdmin) {
  app.get('/api/config/:key', authenticateToken, (req, res) => {
    try {
      const stmt = db.prepare('SELECT value FROM config WHERE key = ?');
      const config = stmt.get(req.params.key);
      res.json(config ? JSON.parse(config.value) : null);
    } catch (error) {
      logger.error(error);
      res.status(500).json({ success: false, error: 'Erreur serveur interne' });
    }
  });

  app.post('/api/config/:key', authenticateToken, requireAdmin, (req, res) => {
    try {
      const stmt = db.prepare(`
        INSERT OR REPLACE INTO config (key, value, modified_by, modified_at)
        VALUES (?, ?, ?, CURRENT_TIMESTAMP)
      `);

      stmt.run(req.params.key, JSON.stringify(req.body), req.user.id);

      res.json({ success: true });
    } catch (error) {
      logger.error(error);
      res.status(500).json({ success: false, error: 'Erreur serveur interne' });
    }
  });

  // Routes spécifiques pour Google Calendar (lecture pour tous, modification admin uniquement)
  app.get('/api/config/google/client-id', authenticateToken, (req, res) => {
    try {
      const stmt = db.prepare('SELECT value FROM config WHERE key = ?');
      const config = stmt.get('google_client_id');
      res.json({ value: config ? config.value : '' });
    } catch (error) {
      logger.error(error);
      res.status(500).json({ success: false, error: 'Erreur serveur interne' });
    }
  });

  app.get('/api/config/google/calendar-id', authenticateToken, (req, res) => {
    try {
      const stmt = db.prepare('SELECT value FROM config WHERE key = ?');
      const config = stmt.get('google_calendar_id');
      res.json({ value: config ? config.value : '' });
    } catch (error) {
      logger.error(error);
      res.status(500).json({ success: false, error: 'Erreur serveur interne' });
    }
  });

  app.get('/api/config/google/maps-api-key', authenticateToken, (req, res) => {
    try {
      const stmt = db.prepare('SELECT value FROM config WHERE key = ?');
      const config = stmt.get('google_maps_api_key');
      res.json({ value: config ? config.value : '' });
    } catch (error) {
      logger.error(error);
      res.status(500).json({ success: false, error: 'Erreur serveur interne' });
    }
  });

  app.post('/api/config/google/client-id', authenticateToken, requireAdmin, (req, res) => {
    try {
      const { value } = req.body;
      const stmt = db.prepare(`
        INSERT OR REPLACE INTO config (key, value, modified_by, modified_at)
        VALUES (?, ?, ?, CURRENT_TIMESTAMP)
      `);
      stmt.run('google_client_id', value, req.user.id);
      res.json({ success: true });
    } catch (error) {
      logger.error(error);
      res.status(500).json({ success: false, error: 'Erreur serveur interne' });
    }
  });

  app.post('/api/config/google/calendar-id', authenticateToken, requireAdmin, (req, res) => {
    try {
      const { value } = req.body;
      const stmt = db.prepare(`
        INSERT OR REPLACE INTO config (key, value, modified_by, modified_at)
        VALUES (?, ?, ?, CURRENT_TIMESTAMP)
      `);
      stmt.run('google_calendar_id', value, req.user.id);
      res.json({ success: true });
    } catch (error) {
      logger.error(error);
      res.status(500).json({ success: false, error: 'Erreur serveur interne' });
    }
  });

  app.post('/api/config/google/maps-api-key', authenticateToken, requireAdmin, (req, res) => {
    try {
      const { value } = req.body;
      const stmt = db.prepare(`
        INSERT OR REPLACE INTO config (key, value, modified_by, modified_at)
        VALUES (?, ?, ?, CURRENT_TIMESTAMP)
      `);
      stmt.run('google_maps_api_key', value, req.user.id);
      res.json({ success: true });
    } catch (error) {
      logger.error(error);
      res.status(500).json({ success: false, error: 'Erreur serveur interne' });
    }
  });

  // Routes pour les détails de trajets
  app.get('/api/trip-details/:reservationId', authenticateToken, (req, res) => {
    try {
      const stmt = db.prepare(
        'SELECT * FROM trip_details WHERE reservation_id = ? ORDER BY event_order',
      );
      const tripDetails = stmt.all(req.params.reservationId);

      // Récupérer les pauses pour chaque trajet
      const pausesStmt = db.prepare('SELECT * FROM trip_pauses WHERE trip_detail_id = ?');
      const enrichedDetails = tripDetails.map((detail) => ({
        ...detail,
        pauses: pausesStmt.all(detail.id),
      }));

      res.json(enrichedDetails);
    } catch (error) {
      logger.error(error);
      res.status(500).json({ success: false, error: 'Erreur serveur interne' });
    }
  });

  app.post('/api/trip-details', authenticateToken, (req, res) => {
    try {
      const detail = req.body;

      const reservationId = detail.reservationId;

      // Vérifier que la réservation existe
      const reservation = db.prepare('SELECT id FROM reservations WHERE id = ?').get(reservationId);
      if (!reservation) {
        return res.status(400).json({ success: false, error: 'Réservation non trouvée' });
      }

      const stmt = db.prepare(`
        INSERT INTO trip_details (
          reservation_id, event_id, event_order,
          departure_location, departure_date, departure_time,
          arrival_location, arrival_date, arrival_time,
          return_departure_location, return_departure_date, return_departure_time,
          return_arrival_location, return_arrival_date, return_arrival_time,
          driver_name, outbound_duration, return_duration,
          has_junction_with_next, junction_location, trip_group_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const result = stmt.run(
        reservationId,
        detail.eventId,
        detail.eventOrder,
        detail.departureLocation,
        detail.departureDate,
        detail.departureTime,
        detail.arrivalLocation,
        detail.arrivalDate,
        detail.arrivalTime,
        detail.returnDepartureLocation,
        detail.returnDepartureDate,
        detail.returnDepartureTime,
        detail.returnArrivalLocation,
        detail.returnArrivalDate,
        detail.returnArrivalTime,
        detail.driverName,
        detail.outboundDuration,
        detail.returnDuration,
        detail.hasJunctionWithNext ? 1 : 0,
        detail.junctionLocation,
        detail.tripGroupId || null,
      );

      // Ajouter les pauses
      if (detail.pauses && detail.pauses.length > 0) {
        const pauseStmt = db.prepare(`
          INSERT INTO trip_pauses (trip_detail_id, pause_type, location, start_time, duration, notes)
          VALUES (?, ?, ?, ?, ?, ?)
        `);

        for (const pause of detail.pauses) {
          pauseStmt.run(
            result.lastInsertRowid,
            pause.pauseType,
            pause.location,
            pause.startTime,
            pause.duration,
            pause.notes,
          );
        }
      }

      // Récupérer les données complètes sauvegardées avec les pauses
      const savedDetail = db
        .prepare(
          `
        SELECT * FROM trip_details WHERE id = ?
      `,
        )
        .get(result.lastInsertRowid);

      const savedPauses = db
        .prepare(
          `
        SELECT * FROM trip_pauses WHERE trip_detail_id = ?
      `,
        )
        .all(result.lastInsertRowid);

      // Retourner les données complètes
      res.json({
        ...savedDetail,
        pauses: savedPauses,
      });
    } catch (error) {
      logger.error(error);
      res.status(500).json({ success: false, error: 'Erreur serveur interne' });
    }
  });

  app.put('/api/trip-details/:id', authenticateToken, (req, res) => {
    try {
      // Vérification existence (cf. AUDIT-MUTATIONS-BACKEND-2026-05-18 §4.1)
      const exists = db.prepare('SELECT id FROM trip_details WHERE id = ?').get(req.params.id);
      if (!exists)
        return res.status(404).json({ success: false, error: 'Détail de trajet non trouvé' });

      const detail = req.body;
      const stmt = db.prepare(`
        UPDATE trip_details SET
          departure_location = ?, departure_date = ?, departure_time = ?,
          arrival_location = ?, arrival_date = ?, arrival_time = ?,
          return_departure_location = ?, return_departure_date = ?, return_departure_time = ?,
          return_arrival_location = ?, return_arrival_date = ?, return_arrival_time = ?,
          driver_name = ?, outbound_duration = ?, return_duration = ?,
          has_junction_with_next = ?, junction_location = ?,
          trip_group_id = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `);

      stmt.run(
        detail.departureLocation,
        detail.departureDate,
        detail.departureTime,
        detail.arrivalLocation,
        detail.arrivalDate,
        detail.arrivalTime,
        detail.returnDepartureLocation,
        detail.returnDepartureDate,
        detail.returnDepartureTime,
        detail.returnArrivalLocation,
        detail.returnArrivalDate,
        detail.returnArrivalTime,
        detail.driverName,
        detail.outboundDuration,
        detail.returnDuration,
        detail.hasJunctionWithNext ? 1 : 0,
        detail.junctionLocation,
        detail.tripGroupId || null,
        req.params.id,
      );

      // Supprimer les anciennes pauses et ajouter les nouvelles
      const deletePausesStmt = db.prepare('DELETE FROM trip_pauses WHERE trip_detail_id = ?');
      deletePausesStmt.run(req.params.id);

      if (detail.pauses && detail.pauses.length > 0) {
        const pauseStmt = db.prepare(`
          INSERT INTO trip_pauses (trip_detail_id, pause_type, location, start_time, duration, notes)
          VALUES (?, ?, ?, ?, ?, ?)
        `);

        for (const pause of detail.pauses) {
          pauseStmt.run(
            req.params.id,
            pause.pauseType,
            pause.location,
            pause.startTime,
            pause.duration,
            pause.notes,
          );
        }
      }

      res.json({ success: true });
    } catch (error) {
      logger.error(error);
      res.status(500).json({ success: false, error: 'Erreur serveur interne' });
    }
  });

  app.delete('/api/trip-details/:id', authenticateToken, (req, res) => {
    try {
      const stmt = db.prepare('DELETE FROM trip_details WHERE id = ?');
      stmt.run(req.params.id);
      res.json({ success: true });
    } catch (error) {
      logger.error(error);
      res.status(500).json({ success: false, error: 'Erreur serveur interne' });
    }
  });

  // Lier les trajets de deux événements (leur donner le même trip_group_id)
  app.post('/api/trip-details/link', authenticateToken, (req, res) => {
    try {
      const { reservationId, eventId1, eventId2 } = req.body;

      if (!reservationId || !eventId1 || !eventId2) {
        return res
          .status(400)
          .json({ success: false, error: 'reservationId, eventId1 et eventId2 sont requis' });
      }

      // Chercher les trip_details existants pour ces événements
      let td1 = db
        .prepare('SELECT * FROM trip_details WHERE reservation_id = ? AND event_id = ?')
        .get(reservationId, eventId1);
      let td2 = db
        .prepare('SELECT * FROM trip_details WHERE reservation_id = ? AND event_id = ?')
        .get(reservationId, eventId2);

      // Créer automatiquement les trip_details manquants (entrées minimales)
      const insertMinimalStmt = db.prepare(`
        INSERT INTO trip_details (reservation_id, event_id, event_order, departure_location, departure_date, departure_time, arrival_location, arrival_date, arrival_time, return_departure_location, return_departure_date, return_departure_time, return_arrival_location, return_arrival_date, return_arrival_time, driver_name, outbound_duration, return_duration, has_junction_with_next, junction_location, trip_group_id)
        VALUES (?, ?, ?, '', '', '', '', '', '', '', '', '', '', '', '', '', NULL, NULL, 0, '', NULL)
      `);

      if (!td1) {
        const maxOrder = db
          .prepare(
            'SELECT COALESCE(MAX(event_order), 0) + 1 as next_order FROM trip_details WHERE reservation_id = ?',
          )
          .get(reservationId);
        insertMinimalStmt.run(reservationId, eventId1, maxOrder.next_order);
        td1 = db
          .prepare('SELECT * FROM trip_details WHERE reservation_id = ? AND event_id = ?')
          .get(reservationId, eventId1);
      }

      if (!td2) {
        const maxOrder = db
          .prepare(
            'SELECT COALESCE(MAX(event_order), 0) + 1 as next_order FROM trip_details WHERE reservation_id = ?',
          )
          .get(reservationId);
        insertMinimalStmt.run(reservationId, eventId2, maxOrder.next_order);
        td2 = db
          .prepare('SELECT * FROM trip_details WHERE reservation_id = ? AND event_id = ?')
          .get(reservationId, eventId2);
      }

      // Déterminer le trip_group_id à utiliser
      let groupId =
        td1?.trip_group_id ||
        td2?.trip_group_id ||
        `tg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Mettre à jour td1
      db.prepare(
        'UPDATE trip_details SET trip_group_id = ?, has_junction_with_next = 1 WHERE id = ?',
      ).run(groupId, td1.id);

      // Mettre à jour td2
      db.prepare('UPDATE trip_details SET trip_group_id = ? WHERE id = ?').run(groupId, td2.id);

      // Fusionner les groupes existants si nécessaire
      // Si td1 ou td2 avait déjà un autre group_id, mettre à jour tous les membres de l'ancien groupe
      if (td1.trip_group_id && td1.trip_group_id !== groupId) {
        db.prepare('UPDATE trip_details SET trip_group_id = ? WHERE trip_group_id = ?').run(
          groupId,
          td1.trip_group_id,
        );
      }
      if (td2.trip_group_id && td2.trip_group_id !== groupId) {
        db.prepare('UPDATE trip_details SET trip_group_id = ? WHERE trip_group_id = ?').run(
          groupId,
          td2.trip_group_id,
        );
      }

      // Récupérer tous les trip_details mis à jour pour cette réservation
      const allDetails = db
        .prepare('SELECT * FROM trip_details WHERE reservation_id = ? ORDER BY event_order')
        .all(reservationId);
      const pausesStmt = db.prepare('SELECT * FROM trip_pauses WHERE trip_detail_id = ?');
      const enrichedDetails = allDetails.map((detail) => ({
        ...detail,
        pauses: pausesStmt.all(detail.id),
      }));

      res.json({ success: true, groupId, tripDetails: enrichedDetails });
    } catch (error) {
      logger.error(error);
      res.status(500).json({ success: false, error: 'Erreur serveur interne' });
    }
  });

  // Délier un événement de son groupe de trajets
  app.post('/api/trip-details/unlink', authenticateToken, (req, res) => {
    try {
      const { reservationId, eventId } = req.body;

      if (!reservationId || !eventId) {
        return res
          .status(400)
          .json({ success: false, error: 'reservationId et eventId sont requis' });
      }

      const td = db
        .prepare('SELECT * FROM trip_details WHERE reservation_id = ? AND event_id = ?')
        .get(reservationId, eventId);

      if (td) {
        const oldGroupId = td.trip_group_id;

        // Retirer du groupe
        db.prepare(
          'UPDATE trip_details SET trip_group_id = NULL, has_junction_with_next = 0 WHERE id = ?',
        ).run(td.id);

        // Si l'ancien groupe ne contient plus qu'un seul membre, le dissoudre
        if (oldGroupId) {
          const remaining = db
            .prepare('SELECT COUNT(*) as count FROM trip_details WHERE trip_group_id = ?')
            .get(oldGroupId);
          if (remaining.count <= 1) {
            db.prepare('UPDATE trip_details SET trip_group_id = NULL WHERE trip_group_id = ?').run(
              oldGroupId,
            );
          }
        }
      }

      // Récupérer tous les trip_details mis à jour
      const allDetails = db
        .prepare('SELECT * FROM trip_details WHERE reservation_id = ? ORDER BY event_order')
        .all(reservationId);
      const pausesStmt = db.prepare('SELECT * FROM trip_pauses WHERE trip_detail_id = ?');
      const enrichedDetails = allDetails.map((detail) => ({
        ...detail,
        pauses: pausesStmt.all(detail.id),
      }));

      res.json({ success: true, tripDetails: enrichedDetails });
    } catch (error) {
      logger.error(error);
      res.status(500).json({ success: false, error: 'Erreur serveur interne' });
    }
  });
}
