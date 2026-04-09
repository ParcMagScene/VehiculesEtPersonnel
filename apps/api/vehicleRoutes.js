import db, { addToHistory, getHistory } from './database.js';
import { alertReservationCreated, alertMaintenanceCreated } from './emailService.js';
import logger from './logger.js';
import { listCache, cacheMiddleware, invalidateEntity } from './cache.js';

// Helper : parser les liens Google Drive (rétrocompatible ancien format string simple)
function parseDriveLinks(value) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed;
    return [{ url: value, label: '' }];
  } catch {
    return value.trim() ? [{ url: value.trim(), label: '' }] : [];
  }
}

export function setupVehicleRoutes(app, authenticateToken, requireAdmin, requireMaintenanceAccess) {

// ============ VÉHICULES ============

app.get('/api/vehicles', authenticateToken, cacheMiddleware(listCache, () => 'vehicles', 30_000), (req, res) => {
  try {
    const stmt = db.prepare('SELECT * FROM vehicles ORDER BY order_index ASC LIMIT 5000');
    const vehicles = stmt.all();
    
    // Mapper snake_case vers camelCase pour le frontend
    const mappedVehicles = vehicles.map(v => ({
      id: v.id,
      name: v.name,
      type: v.type,
      category: v.category,
      registration: v.registration,
      brand: v.brand,
      model: v.model,
      year: v.year,
      color: v.color,
      vin: v.vin,
      status: v.status,
      notes: v.notes,
      photo: v.photo,
      lastMaintenanceDate: v.last_maintenance_date,
      lastMaintenanceKm: v.last_maintenance_km,
      mileageHistory: v.mileage_history,
      controlesTechniques: v.controles_techniques,
      kilometrage: v.kilometrage,
      assigned_to: v.assigned_to,
      pupitre: v.pupitre,
      isInsured: v.is_insured,
      insuranceCompany: v.insurance_company,
      insuranceNumber: v.insurance_number,
      insuranceExpiry: v.insurance_expiry,
      isLocation: v.is_location ? true : false,
      orderIndex: v.order_index || 0,
      latitude: v.latitude,
      longitude: v.longitude,
      locationUpdatedAt: v.location_updated_at
    }));
    
    res.json(mappedVehicles);
  } catch (error) {
    logger.error(error);
    res.status(500).json({ error: 'Erreur serveur interne' });
  }
});

app.post('/api/vehicles', authenticateToken, requireAdmin, (req, res) => {
  try {
    const vehicle = req.body;
    const stmt = db.prepare(`
      INSERT INTO vehicles (id, name, type, category, registration, brand, model, year, color, vin, status, notes, photo,
        last_maintenance_date, last_maintenance_km, controles_techniques, kilometrage, mileage_history, assigned_to, pupitre,
        is_insured, insurance_company, insurance_number, insurance_expiry,
        is_location, order_index,
        latitude, longitude, location_updated_at, created_by, modified_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      vehicle.id,
      vehicle.name,
      vehicle.type,
      vehicle.category || null,
      vehicle.registration,
      vehicle.brand || '',
      vehicle.model || '',
      vehicle.year || null,
      vehicle.color || '',
      vehicle.vin || '',
      vehicle.status || 'available',
      vehicle.notes || '',
      vehicle.photo || '',
      vehicle.last_maintenance_date || null,
      vehicle.last_maintenance_km || null,
      vehicle.controles_techniques || null,
      vehicle.kilometrage || null,
      vehicle.mileage_history || null,
      vehicle.assigned_to || null,
      vehicle.pupitre || null,
      vehicle.is_insured ? 1 : 0,
      vehicle.insurance_company || '',
      vehicle.insurance_number || '',
      vehicle.insurance_expiry || null,
      vehicle.is_location ? 1 : 0,
      vehicle.order_index || 0,
      vehicle.latitude || null,
      vehicle.longitude || null,
      vehicle.location_updated_at || null,
      req.user.id,
      req.user.id
    );
    
    addToHistory('vehicle', vehicle.id, 'created', vehicle, req.user.id, req.user.name);
    invalidateEntity('vehicles');
    
    const saved = db.prepare('SELECT * FROM vehicles WHERE id = ?').get(vehicle.id);
    res.json(saved);
  } catch (error) {
    logger.error(error);
    res.status(500).json({ error: 'Erreur serveur interne' });
  }
});

app.put('/api/vehicles/:id', authenticateToken, requireAdmin, (req, res) => {
  try {
    const vehicle = req.body;

    // Validation kilométrage : doit être >= au kilométrage actuel
    if (vehicle.kilometrage != null) {
      const current = db.prepare('SELECT kilometrage FROM vehicles WHERE id = ?').get(req.params.id);
      const currentKm = current?.kilometrage || 0;
      const newKm = parseInt(vehicle.kilometrage) || 0;
      if (newKm > 0 && currentKm > 0 && newKm < currentKm) {
        return res.status(400).json({
          error: `Le kilométrage (${newKm} km) ne peut pas être inférieur au kilométrage actuel (${currentKm} km)`
        });
      }
    }

    const stmt = db.prepare(`
      UPDATE vehicles SET name = ?, type = ?, category = ?, registration = ?, brand = ?, model = ?, year = ?,
        color = ?, vin = ?, status = ?, notes = ?, photo = ?,
        last_maintenance_date = ?, last_maintenance_km = ?, controles_techniques = ?, kilometrage = ?, mileage_history = ?,
        assigned_to = ?, pupitre = ?,
        is_insured = ?, insurance_company = ?, insurance_number = ?, insurance_expiry = ?,
        is_location = ?, order_index = ?,
        latitude = ?, longitude = ?, location_updated_at = ?,
        modified_by = ?, modified_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    stmt.run(
      vehicle.name,
      vehicle.type,
      vehicle.category || null,
      vehicle.registration,
      vehicle.brand || '',
      vehicle.model || '',
      vehicle.year || null,
      vehicle.color || '',
      vehicle.vin || '',
      vehicle.status || 'available',
      vehicle.notes || '',
      vehicle.photo || '',
      vehicle.last_maintenance_date || null,
      vehicle.last_maintenance_km || null,
      vehicle.controles_techniques || null,
      vehicle.kilometrage || null,
      vehicle.mileage_history || null,
      vehicle.assigned_to || null,
      vehicle.pupitre || null,
      vehicle.is_insured ? 1 : 0,
      vehicle.insurance_company || '',
      vehicle.insurance_number || '',
      vehicle.insurance_expiry || null,
      vehicle.is_location ? 1 : 0,
      vehicle.order_index || 0,
      vehicle.latitude || null,
      vehicle.longitude || null,
      vehicle.location_updated_at || null,
      req.user.id,
      req.params.id
    );
    
    addToHistory('vehicle', req.params.id, 'updated', vehicle, req.user.id, req.user.name);
    invalidateEntity('vehicles');
    
    const saved = db.prepare('SELECT * FROM vehicles WHERE id = ?').get(req.params.id);
    res.json(saved);
  } catch (error) {
    logger.error(error);
    res.status(500).json({ error: 'Erreur serveur interne' });
  }
});

app.delete('/api/vehicles/:id', authenticateToken, requireAdmin, (req, res) => {
  try {
    const stmt = db.prepare('DELETE FROM vehicles WHERE id = ?');
    stmt.run(req.params.id);
    
    addToHistory('vehicle', req.params.id, 'deleted', null, req.user.id, req.user.name);
    invalidateEntity('vehicles');
    
    res.json({ success: true });
  } catch (error) {
    logger.error(error);
    res.status(500).json({ error: 'Erreur serveur interne' });
  }
});

// ============ RÉSERVATIONS ============

app.get('/api/reservations', authenticateToken, cacheMiddleware(listCache, () => 'reservations', 30_000), (req, res) => {
  try {
    const stmt = db.prepare(`
      SELECT r.*, v.name as vehicle_name, v.type as vehicle_type, v.registration as immatriculation
      FROM reservations r
      LEFT JOIN vehicles v ON r.vehicle_id = v.id
    `);
    const reservations = stmt.all();
    
    // Mapper snake_case vers camelCase
    const mappedReservations = reservations.map(r => ({
      id: r.id,
      vehicleId: r.vehicle_id,
      vehicleName: r.vehicle_name || '',
      vehicleType: r.vehicle_type || '',
      immatriculation: r.immatriculation || '',
      clientName: r.client_name,
      driverName: r.driver_name,
      locationName: r.location_name,
      prestationName: r.prestation_name,
      date: r.start_date,
      startDate: r.start_date,
      period: r.start_period,
      startPeriod: r.start_period,
      endDate: r.end_date,
      endPeriod: r.end_period,
      status: r.status,
      comment: r.comment,
      affaire: r.affaire,
      googleEventId: r.google_event_id,
      isTournee: r.is_tournee === 1,
      linkedEventIds: r.linked_event_ids ? JSON.parse(r.linked_event_ids) : null,
      notes: r.notes,
      googleDriveLink: r.google_drive_link || '',
      googleDriveLinks: parseDriveLinks(r.google_drive_link),
      createdBy: r.created_by,
      modifiedBy: r.modified_by,
      createdAt: r.created_at,
      modifiedAt: r.modified_at
    }));
    
    res.json(mappedReservations);
  } catch (error) {
    logger.error(error);
    res.status(500).json({ error: 'Erreur serveur interne' });
  }
});

app.post('/api/reservations', authenticateToken, requireAdmin, (req, res) => {
  try {
    const reservation = req.body;
    
    // Générer un ID côté serveur si non fourni ou invalide
    if (!reservation.id || reservation.id === 'null' || reservation.id === null) {
      reservation.id = `${Date.now()}.${Math.random()}`;
      logger.info('⚠️ ID manquant, génération côté serveur:', reservation.id);
    }
    
    const stmt = db.prepare(`
      INSERT INTO reservations (id, vehicle_id, start_date, start_period, end_date, end_period, 
                               client_name, driver_name, location_name, prestation_name, 
                               notes, google_event_id, google_drive_link, affaire, is_tournee, linked_event_ids, created_by, modified_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      reservation.id,
      reservation.vehicle_id,
      reservation.start_date,
      reservation.start_period || 'AM',
      reservation.end_date,
      reservation.end_period || 'PM',
      reservation.client_name || '',
      reservation.driver_name || '',
      reservation.location_name || '',
      reservation.prestation_name || '',
      reservation.notes || '',
      reservation.google_event_id || '',
      reservation.google_drive_link || '',
      reservation.affaire || '',
      reservation.is_tournee ? 1 : 0,
      reservation.linked_event_ids ? JSON.stringify(reservation.linked_event_ids) : null,
      req.user.id,
      req.user.id
    );
    
    addToHistory('reservation', reservation.id, 'created', reservation, req.user.id, req.user.name);
    
    // Récupérer la réservation complète avec les infos du véhicule
    const createdReservation = db.prepare(`
      SELECT r.*, v.name as vehicle_name, v.type as vehicle_type, v.registration as immatriculation
      FROM reservations r
      JOIN vehicles v ON r.vehicle_id = v.id
      WHERE r.id = ?
    `).get(reservation.id);
    
    if (!createdReservation) {
      return res.status(500).json({ error: 'Erreur lors de la récupération de la réservation créée' });
    }
    
    // Mapper au format attendu par le frontend
    const mappedReservation = {
      id: createdReservation.id,
      vehicleId: createdReservation.vehicle_id,
      vehicleName: createdReservation.vehicle_name,
      vehicleType: createdReservation.vehicle_type,
      immatriculation: createdReservation.immatriculation,
      startDate: createdReservation.start_date,
      startPeriod: createdReservation.start_period,
      endDate: createdReservation.end_date,
      endPeriod: createdReservation.end_period,
      // Rétrocompatibilité
      date: createdReservation.start_date,
      period: createdReservation.start_period,
      clientName: createdReservation.client_name,
      driverName: createdReservation.driver_name,
      locationName: createdReservation.location_name,
      prestationName: createdReservation.prestation_name,
      notes: createdReservation.notes,
      googleEventId: createdReservation.google_event_id,
      affaire: createdReservation.affaire,
      isTournee: Boolean(createdReservation.is_tournee),
      linkedEventIds: createdReservation.linked_event_ids ? JSON.parse(createdReservation.linked_event_ids) : [],
      googleDriveLink: createdReservation.google_drive_link || ''
    };
    
    // Alerte email aux admins
    alertReservationCreated(db, mappedReservation, req.user.name)
      .catch(err => logger.warn('Email alerte réservation échoué:', err.message));
    
    invalidateEntity('reservations');
    invalidateEntity('affaires');
    res.json(mappedReservation);
  } catch (error) {
    logger.error(error);
    res.status(500).json({ error: 'Erreur serveur interne' });
  }
});

app.put('/api/reservations/:id', authenticateToken, requireAdmin, (req, res) => {
  try {
    const reservation = req.body;

    // Préserver les liens Google Drive existants (gérés uniquement via PATCH depuis EventDetailsModal)
    const existing = db.prepare('SELECT google_drive_link FROM reservations WHERE id = ?').get(req.params.id);
    const existingDriveLink = existing ? existing.google_drive_link : '';

    const stmt = db.prepare(`
      UPDATE reservations 
      SET vehicle_id = ?, start_date = ?, start_period = ?, end_date = ?, end_period = ?,
          client_name = ?, driver_name = ?, location_name = ?, prestation_name = ?,
          notes = ?, google_event_id = ?, google_drive_link = ?, affaire = ?, is_tournee = ?, linked_event_ids = ?,
          modified_by = ?, modified_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    
    stmt.run(
      reservation.vehicleId || reservation.vehicle_id,
      reservation.date || reservation.start_date,
      reservation.period || reservation.start_period || 'AM',
      reservation.endDate || reservation.end_date,
      reservation.endPeriod || reservation.end_period || 'PM',
      reservation.clientName || reservation.client_name || '',
      reservation.driverName || reservation.driver_name || '',
      reservation.locationName || reservation.location_name || '',
      reservation.prestationName || reservation.prestation_name || '',
      reservation.notes || '',
      reservation.googleEventId || reservation.google_event_id || '',
      existingDriveLink || '',
      reservation.affaire || '',
      reservation.isTournee || reservation.is_tournee ? 1 : 0,
      (reservation.linkedEventIds || reservation.linked_event_ids) ? JSON.stringify(reservation.linkedEventIds || reservation.linked_event_ids) : null,
      req.user.id,
      req.params.id
    );
    
    addToHistory('reservation', req.params.id, 'updated', reservation, req.user.id, req.user.name);
    invalidateEntity('reservations');
    invalidateEntity('affaires');
    
    res.json({ success: true });
  } catch (error) {
    logger.error(error);
    res.status(500).json({ error: 'Erreur serveur interne' });
  }
});

// Mise à jour partielle d'une réservation (liens Google Drive)
app.patch('/api/reservations/:id', authenticateToken, requireAdmin, (req, res) => {
  try {
    const { google_drive_links, google_drive_link } = req.body;
    
    // Support nouveau format (tableau) ou ancien format (string)
    let linksToStore;
    if (google_drive_links !== undefined) {
      // Nouveau format : tableau de {url, label}
      if (!Array.isArray(google_drive_links)) {
        return res.status(400).json({ error: 'google_drive_links doit être un tableau' });
      }
      linksToStore = JSON.stringify(google_drive_links);
    } else if (google_drive_link !== undefined) {
      // Ancien format rétrocompatible : string simple
      linksToStore = google_drive_link || '';
    } else {
      return res.status(400).json({ error: 'Champ manquant (google_drive_links ou google_drive_link)' });
    }
    
    const stmt = db.prepare(`
      UPDATE reservations SET google_drive_link = ?, modified_by = ?, modified_at = CURRENT_TIMESTAMP WHERE id = ?
    `);
    stmt.run(linksToStore, req.user.id, req.params.id);
    addToHistory('reservation', req.params.id, 'updated', { google_drive_links: google_drive_links || google_drive_link }, req.user.id, req.user.name);
    
    const updatedLinks = parseDriveLinks(linksToStore);
    res.json({ success: true, googleDriveLinks: updatedLinks, googleDriveLink: linksToStore });
  } catch (error) {
    logger.error(error);
    res.status(500).json({ error: 'Erreur serveur interne' });
  }
});

app.delete('/api/reservations/:id', authenticateToken, requireAdmin, (req, res) => {
  try {
    const stmt = db.prepare('DELETE FROM reservations WHERE id = ?');
    stmt.run(req.params.id);
    
    addToHistory('reservation', req.params.id, 'deleted', null, req.user.id, req.user.name);
    invalidateEntity('reservations');
    invalidateEntity('affaires');
    
    res.json({ success: true });
  } catch (error) {
    logger.error(error);
    res.status(500).json({ error: 'Erreur serveur interne' });
  }
});

// ============ DEMANDES DE RÉSERVATION ============

app.get('/api/reservation-requests', authenticateToken, (req, res) => {
  try {
    // Admins see all requests, regular users see only their own
    const isAdmin = req.user && req.user.isAdmin;
    let requests;
    if (isAdmin) {
      requests = db.prepare(`
        SELECT rr.*, u.name as requester_name, u.email as requester_email
        FROM reservation_requests rr
        LEFT JOIN users u ON rr.requested_by = u.id
        ORDER BY rr.requested_at DESC
      `).all();
    } else {
      requests = db.prepare(`
        SELECT rr.*, u.name as requester_name, u.email as requester_email
        FROM reservation_requests rr
        LEFT JOIN users u ON rr.requested_by = u.id
        WHERE rr.requested_by = ?
        ORDER BY rr.requested_at DESC
      `).all(req.user.id);
    }
    res.json(requests);
  } catch (error) {
    logger.error(error);
    res.status(500).json({ error: 'Erreur serveur interne' });
  }
});

app.post('/api/reservation-requests', authenticateToken, (req, res) => {
  try {
    const request = req.body;
    const stmt = db.prepare(`
      INSERT INTO reservation_requests (id, vehicle_id, start_date, start_period, end_date, end_period,
                                       client_name, driver_name, location_name, prestation_name, notes, requested_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      request.id,
      request.vehicle_id,
      request.start_date,
      request.start_period || 'AM',
      request.end_date,
      request.end_period || 'PM',
      request.client_name || '',
      request.driver_name || '',
      request.location_name || '',
      request.prestation_name || '',
      request.notes || '',
      req.user.id
    );
    
    res.json({ success: true, id: request.id });
  } catch (error) {
    logger.error(error);
    res.status(500).json({ error: 'Erreur serveur interne' });
  }
});

app.put('/api/reservation-requests/:id/approve', authenticateToken, (req, res) => {
  try {
    // Vérifier que l'utilisateur est admin
    const userStmt = db.prepare('SELECT is_admin FROM users WHERE id = ?');
    const user = userStmt.get(req.user.id);
    
    if (!user || !user.is_admin) {
      return res.status(403).json({ error: 'Accès réservé aux administrateurs' });
    }

    // Récupérer la demande
    const requestStmt = db.prepare('SELECT * FROM reservation_requests WHERE id = ?');
    const request = requestStmt.get(req.params.id);
    
    if (!request) {
      return res.status(404).json({ error: 'Demande introuvable' });
    }

    // [AUDIT FIX HIGH-3] Vérifier les chevauchements avec les réservations existantes
    const overlapStmt = db.prepare(`
      SELECT id, start_date, end_date, client_name 
      FROM reservations 
      WHERE vehicle_id = ? 
        AND start_date <= ? AND end_date >= ?
    `);
    const conflicts = overlapStmt.all(request.vehicle_id, request.end_date, request.start_date);
    
    if (conflicts.length > 0) {
      return res.status(409).json({
        error: 'Ce véhicule est déjà réservé sur cette période',
        conflicts: conflicts.map(c => ({
          id: c.id,
          start_date: c.start_date,
          end_date: c.end_date,
          client_name: c.client_name
        }))
      });
    }

    // Créer la réservation
    const insertStmt = db.prepare(`
      INSERT INTO reservations (id, vehicle_id, start_date, start_period, end_date, end_period,
                               client_name, driver_name, location_name, prestation_name, notes,
                               created_by, modified_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    insertStmt.run(
      request.id,
      request.vehicle_id,
      request.start_date,
      request.start_period,
      request.end_date,
      request.end_period,
      request.client_name,
      request.driver_name,
      request.location_name,
      request.prestation_name,
      request.notes,
      req.user.id,
      req.user.id
    );

    // Mettre à jour le statut de la demande
    const updateStmt = db.prepare(`
      UPDATE reservation_requests 
      SET status = 'approved', reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    updateStmt.run(req.user.id, req.params.id);
    
    addToHistory('reservation_request', req.params.id, 'approved', request, req.user.id, req.user.name);
    
    res.json({ success: true });
  } catch (error) {
    logger.error(error);
    res.status(500).json({ error: 'Erreur serveur interne' });
  }
});

app.put('/api/reservation-requests/:id/reject', authenticateToken, (req, res) => {
  try {
    // Vérifier que l'utilisateur est admin
    const userStmt = db.prepare('SELECT is_admin FROM users WHERE id = ?');
    const user = userStmt.get(req.user.id);
    
    if (!user || !user.is_admin) {
      return res.status(403).json({ error: 'Accès réservé aux administrateurs' });
    }

    const updateStmt = db.prepare(`
      UPDATE reservation_requests 
      SET status = 'rejected', reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP, rejection_reason = ?
      WHERE id = ?
    `);
    updateStmt.run(req.user.id, req.body.reason || '', req.params.id);
    
    addToHistory('reservation_request', req.params.id, 'rejected', { reason: req.body.reason }, req.user.id, req.user.name);
    
    res.json({ success: true });
  } catch (error) {
    logger.error(error);
    res.status(500).json({ error: 'Erreur serveur interne' });
  }
});

// ============ MAINTENANCES ============

app.get('/api/maintenances', authenticateToken, cacheMiddleware(listCache, () => 'maintenances', 30_000), (req, res) => {
  try {
    const stmt = db.prepare(`
      SELECT m.*, u.name as creator_name 
      FROM maintenances m 
      LEFT JOIN users u ON m.created_by = u.id
    `);
    const maintenances = stmt.all();
    
    // Mapper snake_case vers camelCase pour compatibilité frontend
    const mappedMaintenances = maintenances.map(m => ({
      id: m.id,
      vehicleId: m.vehicle_id,
      vehicleName: m.vehicle_name,
      type: m.type,
      status: m.status,
      date: m.date,
      startDate: m.date,
      endDate: m.end_date,
      startDatePeriod: m.start_date_period || 'AM',
      endDatePeriod: m.end_date_period || 'PM',
      description: m.description,
      garageId: m.garage_id,
      cost: m.cost,
      mileage: m.mileage,
      notes: m.notes,
      isImmobilized: m.is_immobilized,
      isQuickReport: m.is_quick_report,
      technicalControlType: m.technical_control_type,
      createdBy: m.created_by,
      creatorName: m.creator_name || 'Inconnu',
      modifiedBy: m.modified_by,
      createdAt: m.created_at,
      modifiedAt: m.modified_at
    }));
    
    res.json(mappedMaintenances);
  } catch (error) {
    logger.error(error);
    res.status(500).json({ error: 'Erreur serveur interne' });
  }
});

app.post('/api/maintenances', authenticateToken, (req, res) => {
  try {
    const maintenance = req.body;
    
    // Vérifier permissions (admin, can_manage_vehicle_maintenance ou legacy can_manage_maintenance)
    let canFullAccess = req.user.isAdmin;
    if (!canFullAccess) {
      const userDb = db.prepare('SELECT permissions FROM users WHERE id = ?').get(req.user.id);
      try {
        const perms = userDb?.permissions ? JSON.parse(userDb.permissions) : {};
        canFullAccess = !!perms.can_manage_vehicle_maintenance || !!perms.can_manage_maintenance;
      } catch { /* ignore */ }
    }
    
    // Les utilisateurs sans permission ne peuvent créer que des signalements
    if (!canFullAccess && maintenance.status !== 'reported') {
      return res.status(403).json({ 
        error: 'Accès refusé',
        message: 'Vous ne pouvez que signaler des pannes. Pour programmer une intervention, contactez un administrateur.'
      });
    }
    
    const stmt = db.prepare(`
      INSERT INTO maintenances (id, vehicle_id, vehicle_name, type, status, date, end_date, 
                               start_date_period, end_date_period,
                               description, garage_id, cost, mileage, notes, is_immobilized, 
                               is_quick_report, technical_control_type, created_by, modified_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    // Résoudre les champs date (supporte camelCase ET snake_case depuis toSnakeCase)
    const resolvedDate = maintenance.start_date || maintenance.startDate || maintenance.date || null;
    const resolvedEndDate = maintenance.end_date || maintenance.endDate || resolvedDate;
    
    stmt.run(
      maintenance.id,
      maintenance.vehicle_id,
      maintenance.vehicle_name || '',
      maintenance.type || 'other',
      maintenance.status || 'pending',
      resolvedDate,
      resolvedEndDate,
      maintenance.start_date_period || 'AM',
      maintenance.end_date_period || 'PM',
      maintenance.description || '',
      maintenance.garage_id || null,
      maintenance.cost || null,
      maintenance.mileage || null,
      maintenance.notes || '',
      maintenance.is_immobilized ? 1 : 0,
      maintenance.is_quick_report ? 1 : 0,
      maintenance.technical_control_type || null,
      req.user.id,
      req.user.id
    );
    
    addToHistory('maintenance', maintenance.id, 'created', maintenance, req.user.id, req.user.name);

    // Alerte email maintenance / contrôle technique
    try {
      const veh = db.prepare('SELECT name FROM vehicles WHERE id = ?').get(maintenance.vehicle_id);
      alertMaintenanceCreated(db, maintenance, veh?.name || 'Véhicule inconnu', req.user.name);
    } catch (emailErr) { logger.warn('Alerte email maintenance:', emailErr.message); }
    
    // Si un kilométrage est renseigné, mettre à jour le véhicule et ajouter un relevé dans l'historique
    if (maintenance.mileage && parseInt(maintenance.mileage) > 0) {
      const vehicleId = maintenance.vehicle_id;
      const newKm = parseInt(maintenance.mileage);
      const oldVehicle = db.prepare('SELECT kilometrage, name FROM vehicles WHERE id = ?').get(vehicleId);
      const oldKm = oldVehicle ? (oldVehicle.kilometrage || 0) : 0;
      
      if (newKm !== oldKm) {
        db.prepare('UPDATE vehicles SET kilometrage = ?, modified_by = ?, modified_at = CURRENT_TIMESTAMP WHERE id = ?')
          .run(newKm, req.user.id, vehicleId);
        
        addToHistory('vehicle', vehicleId, 'mileage_update', JSON.stringify({
          description: 'Relevé kilométrique (maintenance)',
          oldKilometrage: oldKm,
          newKilometrage: newKm,
          maintenanceId: maintenance.id,
          vehicleName: oldVehicle?.name || '',
          date: new Date().toISOString()
        }), req.user.id, req.user.name);
      }
    }
    
    invalidateEntity('maintenances');
    res.json({ success: true, id: maintenance.id });
  } catch (error) {
    logger.error(error);
    res.status(500).json({ error: 'Erreur serveur interne' });
  }
});

app.put('/api/maintenances/:id', authenticateToken, (req, res) => {
  try {
    const maintenance = req.body;
    
    // Vérifier permissions (can_manage_vehicle_maintenance ou legacy can_manage_maintenance)
    let canFullAccess = req.user.isAdmin;
    if (!canFullAccess) {
      const userDb = db.prepare('SELECT permissions FROM users WHERE id = ?').get(req.user.id);
      try {
        const perms = userDb?.permissions ? JSON.parse(userDb.permissions) : {};
        canFullAccess = !!perms.can_manage_vehicle_maintenance || !!perms.can_manage_maintenance;
      } catch { /* ignore */ }
    }
    
    // Utilisateurs avec permission maintenance = accès complet, sinon restrictions
    if (!canFullAccess) {
      const existing = db.prepare('SELECT created_by, status FROM maintenances WHERE id = ?').get(req.params.id);
      
      if (!existing) {
        return res.status(404).json({ error: 'Maintenance introuvable' });
      }
      
      // Les non-autorisés peuvent uniquement modifier leurs propres signalements
      if (existing.created_by !== req.user.id) {
        return res.status(403).json({ 
          error: 'Accès refusé',
          message: 'Vous ne pouvez modifier que vos propres signalements.'
        });
      }
      
      // Empêcher le changement de statut pour les non-autorisés
      if (maintenance.status !== existing.status) {
        return res.status(403).json({ 
          error: 'Accès refusé',
          message: 'Seuls les administrateurs peuvent changer le statut d\'une intervention.'
        });
      }
    }
    
    const stmt = db.prepare(`
      UPDATE maintenances 
      SET vehicle_id = ?, type = ?, status = ?, date = ?, end_date = ?, 
          start_date_period = ?, end_date_period = ?,
          description = ?, garage_id = ?, cost = ?, mileage = ?, notes = ?, is_immobilized = ?,
          is_quick_report = ?, technical_control_type = ?, modified_by = ?, modified_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    
    // Résoudre les champs date (supporte camelCase ET snake_case depuis toSnakeCase)
    const resolvedDate = maintenance.startDate || maintenance.start_date || maintenance.date || null;
    const resolvedEndDate = maintenance.endDate || maintenance.end_date || resolvedDate;
    
    stmt.run(
      maintenance.vehicleId || maintenance.vehicle_id,
      maintenance.type,
      maintenance.status,
      resolvedDate,
      resolvedEndDate,
      maintenance.startDatePeriod || maintenance.start_date_period || 'AM',
      maintenance.endDatePeriod || maintenance.end_date_period || 'PM',
      maintenance.description,
      maintenance.garageId || maintenance.garage_id || null,
      maintenance.cost || null,
      maintenance.mileage || null,
      maintenance.notes || null,
      maintenance.isImmobilized || maintenance.is_immobilized ? 1 : 0,
      maintenance.isQuickReport || maintenance.is_quick_report ? 1 : 0,
      maintenance.technicalControlType || maintenance.technical_control_type || null,
      req.user.id,
      req.params.id
    );
    
    // Si l'intervention est de type technical_inspection et passe à "completed",
    // mettre à jour la deadline du contrôle technique correspondant
    if (maintenance.type === 'technical_inspection' && 
        maintenance.status === 'completed' && 
        (maintenance.technicalControlType || maintenance.technical_control_type)) {
      
      const vehicleId = maintenance.vehicleId || maintenance.vehicle_id;
      const controlType = maintenance.technicalControlType || maintenance.technical_control_type;
      const completionDate = maintenance.endDate || maintenance.end_date || maintenance.startDate || maintenance.date;
      
      // Récupérer le véhicule pour mettre à jour ses contrôles techniques
      const vehicle = db.prepare('SELECT controles_techniques FROM vehicles WHERE id = ?').get(vehicleId);
      
      if (vehicle) {
        let controles = [];
        try {
          controles = vehicle.controles_techniques ? JSON.parse(vehicle.controles_techniques) : [];
        } catch (e) {
          logger.error('Erreur parsing controles_techniques:', e);
          controles = [];
        }
        
        // Trouver le contrôle correspondant
        const controleIndex = controles.findIndex(c => c.type === controlType);
        
        if (controleIndex >= 0) {
          // Calculer la nouvelle deadline selon le type de contrôle
          const periodicDelays = {
            'VL': 24,      // 24 mois
            'PL': 12,      // 12 mois
            'SEMI': 12,    // 12 mois
            'SCENE': 12,   // 12 mois
            'POLLUTION': 12, // 12 mois
            'HAYON': 6,    // 6 mois
            'TACHYGRAPHE': 24, // 24 mois
            'LIMITEUR': 12  // 12 mois
          };
          
          const delayMonths = periodicDelays[controlType] || 12;
          const date = new Date(completionDate);
          date.setMonth(date.getMonth() + delayMonths);
          const newDeadline = date.toISOString().split('T')[0];
          
          // Mettre à jour le contrôle
          controles[controleIndex] = {
            ...controles[controleIndex],
            date: completionDate,
            deadline: newDeadline
          };
          
          // Sauvegarder les contrôles mis à jour
          const updateStmt = db.prepare('UPDATE vehicles SET controles_techniques = ? WHERE id = ?');
          updateStmt.run(JSON.stringify(controles), vehicleId);
          
          logger.info(`✅ Deadline CT ${controlType} mise à jour pour véhicule ${vehicleId}: ${newDeadline}`);
        }
      }
    }
    
    addToHistory('maintenance', req.params.id, 'updated', maintenance, req.user.id, req.user.name);
    
    // Si un kilométrage est renseigné, mettre à jour le véhicule et ajouter un relevé dans l'historique
    if (maintenance.mileage && parseInt(maintenance.mileage) > 0) {
      const vehicleId = maintenance.vehicleId || maintenance.vehicle_id;
      const newKm = parseInt(maintenance.mileage);
      const oldVehicle = db.prepare('SELECT kilometrage, name FROM vehicles WHERE id = ?').get(vehicleId);
      const oldKm = oldVehicle ? (oldVehicle.kilometrage || 0) : 0;
      
      if (newKm !== oldKm) {
        db.prepare('UPDATE vehicles SET kilometrage = ?, modified_by = ?, modified_at = CURRENT_TIMESTAMP WHERE id = ?')
          .run(newKm, req.user.id, vehicleId);
        
        addToHistory('vehicle', vehicleId, 'mileage_update', JSON.stringify({
          description: 'Relevé kilométrique (maintenance)',
          oldKilometrage: oldKm,
          newKilometrage: newKm,
          maintenanceId: req.params.id,
          vehicleName: oldVehicle?.name || '',
          date: new Date().toISOString()
        }), req.user.id, req.user.name);
      }
    }
    
    invalidateEntity('maintenances');
    res.json({ success: true });
  } catch (error) {
    logger.error(error);
    res.status(500).json({ error: 'Erreur serveur interne' });
  }
});

app.delete('/api/maintenances/:id', authenticateToken, requireMaintenanceAccess, (req, res) => {
  try {
    const stmt = db.prepare('DELETE FROM maintenances WHERE id = ?');
    stmt.run(req.params.id);
    
    addToHistory('maintenance', req.params.id, 'deleted', null, req.user.id, req.user.name);
    invalidateEntity('maintenances');
    
    res.json({ success: true });
  } catch (error) {
    logger.error(error);
    res.status(500).json({ error: 'Erreur serveur interne' });
  }
});

// ============ HISTORIQUE ============

app.get('/api/history/:entityType/:entityId', authenticateToken, (req, res) => {
  try {
    const history = getHistory(req.params.entityType, req.params.entityId);
    res.json(history);
  } catch (error) {
    logger.error(error);
    res.status(500).json({ error: 'Erreur serveur interne' });
  }
});

} // end setupVehicleRoutes
