import { existsSync, mkdirSync, readdirSync, unlinkSync } from 'fs';
import multer from 'multer';
import { dirname, extname, join } from 'path';
import { fileURLToPath } from 'url';

import { cacheMiddleware, invalidateEntity, listCache } from './cache.js';
import { reservationsDao } from './dao/reservations.dao.js';
import db, { addToHistory, getHistory } from './database.js';
import { alertMaintenanceCreated, alertReservationCreated } from './emailService.js';
import logger from './logger.js';
import { validateFileTypes } from './middleware/validateFileType.js';
import { validate } from './schemas/imports.js';
import {
  maintenanceSchema,
  reservationRequestSchema,
  reservationSchema,
  vehicleSchema,
} from './schemas/vehicles.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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

// Helper : calculer le prix de location d'une réservation
// Logique : on calcule le nombre de demi-journées, puis on optimise mois > semaines > jours
function calculateRentalPrice(vehicle, startDate, startPeriod, endDate, endPeriod) {
  if (!vehicle || !vehicle.is_location) return null;
  const dailyRate = vehicle.daily_rate || 0;
  const weeklyRate = vehicle.weekly_rate || 0;
  const monthlyRate = vehicle.monthly_rate || 0;
  if (dailyRate === 0 && weeklyRate === 0 && monthlyRate === 0) return null;

  // Calculer le nombre de jours (une demi-journée = 0.5)
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return null;

  let days = Math.round((end - start) / 86400000);

  // Ajuster pour les demi-journées AM/PM
  // Même jour : AM-AM=0.5, AM-PM=1, PM-PM=0.5
  // Multi-jours : les bornes comptent en demi-journée
  if (days === 0) {
    days = startPeriod === 'AM' && endPeriod === 'PM' ? 1 : 0.5;
  } else {
    // Jour de début : AM = journée complète, PM = demi-journée
    const startFraction = startPeriod === 'AM' ? 1 : 0.5;
    // Jour de fin : AM = demi-journée, PM = journée complète
    const endFraction = endPeriod === 'PM' ? 1 : 0.5;
    // Jours intermédiaires = jours - 1
    days = days - 1 + startFraction + endFraction;
  }

  // Optimiser : mois (30j) > semaines (7j) > jours
  let total = 0;
  let remaining = days;

  if (monthlyRate > 0 && remaining >= 30) {
    const months = Math.floor(remaining / 30);
    total += months * monthlyRate;
    remaining -= months * 30;
  }
  if (weeklyRate > 0 && remaining >= 7) {
    const weeks = Math.floor(remaining / 7);
    total += weeks * weeklyRate;
    remaining -= weeks * 7;
  }
  if (dailyRate > 0 && remaining > 0) {
    total += remaining * dailyRate;
  }

  return Math.round(total * 100) / 100; // Arrondi 2 décimales
}

// Résoudre les droits maintenance côté DB (source de vérité), avec compat legacy camelCase.
function hasMaintenanceFullAccess(userId, tokenIsAdmin = false) {
  if (tokenIsAdmin) return true;

  const userDb = db.prepare('SELECT is_admin, permissions FROM users WHERE id = ?').get(userId);
  if (!userDb) return false;
  if (userDb.is_admin) return true;

  try {
    const perms = userDb.permissions ? JSON.parse(userDb.permissions) : {};
    return (
      !!perms.can_manage_vehicle_maintenance ||
      !!perms.can_manage_maintenance ||
      !!perms.canManageVehicleMaintenance ||
      !!perms.canManageMaintenance
    );
  } catch {
    return false;
  }
}

export function setupVehicleRoutes(
  app,
  authenticateToken,
  requireAdmin,
  requireMaintenanceAccess,
  requireNotReadOnly = requireAdmin,
) {
  // ============ VÉHICULES ============

  app.get(
    '/api/vehicles',
    authenticateToken,
    cacheMiddleware(listCache, () => 'vehicles', 30_000),
    (req, res) => {
      try {
        const parsePositiveInt = (value, fallback) => {
          const parsed = Number.parseInt(value, 10);
          return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
        };
        const parseNonNegativeInt = (value, fallback) => {
          const parsed = Number.parseInt(value, 10);
          return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
        };

        const pageSize = Math.min(
          parsePositiveInt(req.query.pageSize ?? req.query.limit, 5000),
          5000,
        );
        const page = parsePositiveInt(req.query.page, 1);
        const hasOffset = req.query.offset !== undefined;
        const offset = hasOffset ? parseNonNegativeInt(req.query.offset, 0) : (page - 1) * pageSize;

        const stmt = db.prepare('SELECT * FROM vehicles ORDER BY order_index ASC LIMIT ? OFFSET ?');
        const vehicles = stmt.all(pageSize, offset);

        // Mapper snake_case vers camelCase pour le frontend
        const mappedVehicles = vehicles.map((v) => ({
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
          dailyRate: v.daily_rate || 0,
          weeklyRate: v.weekly_rate || 0,
          monthlyRate: v.monthly_rate || 0,
          orderIndex: v.order_index || 0,
          latitude: v.latitude,
          longitude: v.longitude,
          locationUpdatedAt: v.location_updated_at,
        }));

        res.json(mappedVehicles);
      } catch (error) {
        logger.error(error);
        res.status(500).json({ success: false, error: 'Erreur serveur interne' });
      }
    },
  );

  app.post(
    '/api/vehicles',
    authenticateToken,
    requireAdmin,
    validate(vehicleSchema),
    (req, res) => {
      try {
        const vehicle = req.body;
        const stmt = db.prepare(`
      INSERT INTO vehicles (id, name, type, category, registration, brand, model, year, color, vin, status, notes, photo,
        last_maintenance_date, last_maintenance_km, controles_techniques, kilometrage, mileage_history, assigned_to, pupitre,
        is_insured, insurance_company, insurance_number, insurance_expiry,
        is_location, daily_rate, weekly_rate, monthly_rate, order_index,
        latitude, longitude, location_updated_at, created_by, modified_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
          vehicle.daily_rate || 0,
          vehicle.weekly_rate || 0,
          vehicle.monthly_rate || 0,
          vehicle.order_index || 0,
          vehicle.latitude || null,
          vehicle.longitude || null,
          vehicle.location_updated_at || null,
          req.user.id,
          req.user.id,
        );

        addToHistory('vehicle', vehicle.id, 'created', vehicle, req.user.id, req.user.name);
        invalidateEntity('vehicles');

        const saved = db.prepare('SELECT * FROM vehicles WHERE id = ?').get(vehicle.id);
        res.json(saved);
      } catch (error) {
        logger.error(error);
        res.status(500).json({ success: false, error: 'Erreur serveur interne' });
      }
    },
  );

  app.put(
    '/api/vehicles/:id',
    authenticateToken,
    requireAdmin,
    validate(vehicleSchema),
    (req, res) => {
      try {
        const vehicle = req.body;

        // Validation kilométrage : doit être >= au kilométrage actuel
        if (vehicle.kilometrage != null) {
          const current = db
            .prepare('SELECT kilometrage FROM vehicles WHERE id = ?')
            .get(req.params.id);
          const currentKm = current?.kilometrage || 0;
          const newKm = parseInt(vehicle.kilometrage) || 0;
          if (newKm > 0 && currentKm > 0 && newKm < currentKm) {
            return res.status(400).json({
              error: `Le kilométrage (${newKm} km) ne peut pas être inférieur au kilométrage actuel (${currentKm} km)`,
            });
          }
        }

        const stmt = db.prepare(`
      UPDATE vehicles SET name = ?, type = ?, category = ?, registration = ?, brand = ?, model = ?, year = ?,
        color = ?, vin = ?, status = ?, notes = ?, photo = ?,
        last_maintenance_date = ?, last_maintenance_km = ?, controles_techniques = ?, kilometrage = ?, mileage_history = ?,
        assigned_to = ?, pupitre = ?,
        is_insured = ?, insurance_company = ?, insurance_number = ?, insurance_expiry = ?,
        is_location = ?, daily_rate = ?, weekly_rate = ?, monthly_rate = ?, order_index = ?,
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
          vehicle.daily_rate || 0,
          vehicle.weekly_rate || 0,
          vehicle.monthly_rate || 0,
          vehicle.order_index || 0,
          vehicle.latitude || null,
          vehicle.longitude || null,
          vehicle.location_updated_at || null,
          req.user.id,
          req.params.id,
        );

        addToHistory('vehicle', req.params.id, 'updated', vehicle, req.user.id, req.user.name);
        invalidateEntity('vehicles');

        const saved = db.prepare('SELECT * FROM vehicles WHERE id = ?').get(req.params.id);
        res.json(saved);
      } catch (error) {
        logger.error(error);
        res.status(500).json({ success: false, error: 'Erreur serveur interne' });
      }
    },
  );

  app.delete('/api/vehicles/:id', authenticateToken, requireAdmin, (req, res) => {
    try {
      // Vérification existence (cf. AUDIT-MUTATIONS-BACKEND-2026-05-18 §4.1)
      const result = db.prepare('DELETE FROM vehicles WHERE id = ?').run(req.params.id);
      if (result.changes === 0)
        return res.status(404).json({ success: false, error: 'Véhicule non trouvé' });

      addToHistory('vehicle', req.params.id, 'deleted', null, req.user.id, req.user.name);
      invalidateEntity('vehicles');

      res.json({ success: true });
    } catch (error) {
      logger.error(error);
      res.status(500).json({ success: false, error: 'Erreur serveur interne' });
    }
  });

  // ============ RÉSERVATIONS ============

  app.get(
    '/api/reservations',
    authenticateToken,
    cacheMiddleware(listCache, () => 'reservations', 30_000),
    (req, res) => {
      try {
        // Phase 1 — DAO : remplace la requête SQL inline + mapping manuel
        res.json(reservationsDao.listMapped());
      } catch (error) {
        logger.error(error);
        res.status(500).json({ success: false, error: 'Erreur serveur interne' });
      }
    },
  );

  app.post(
    '/api/reservations',
    authenticateToken,
    requireAdmin,
    validate(reservationSchema),
    async (req, res) => {
      try {
        const reservation = req.body;

        // Générer un ID côté serveur si non fourni ou invalide
        if (!reservation.id || reservation.id === 'null' || reservation.id === null) {
          reservation.id = `${Date.now()}.${Math.random()}`;
          logger.info('⚠️ ID manquant, génération côté serveur:', reservation.id);
        }

        // Calcul automatique du prix de location si véhicule de location
        const vehicleForPrice = db
          .prepare('SELECT * FROM vehicles WHERE id = ?')
          .get(reservation.vehicle_id);
        const rentalPrice = calculateRentalPrice(
          vehicleForPrice,
          reservation.start_date,
          reservation.start_period || 'AM',
          reservation.end_date,
          reservation.end_period || 'PM',
        );

        const stmt = db.prepare(`
      INSERT INTO reservations (id, vehicle_id, start_date, start_period, end_date, end_period, 
                               client_name, driver_name, location_name, prestation_name, 
                               notes, google_event_id, google_drive_link, affaire, is_tournee, linked_event_ids,
                               rental_price, created_by, modified_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
          rentalPrice,
          req.user.id,
          req.user.id,
        );

        addToHistory(
          'reservation',
          reservation.id,
          'created',
          reservation,
          req.user.id,
          req.user.name,
        );

        // Récupérer la réservation complète avec les infos du véhicule
        const createdReservation = db
          .prepare(
            `
      SELECT r.*, v.name as vehicle_name, v.type as vehicle_type, v.registration as immatriculation
      FROM reservations r
      JOIN vehicles v ON r.vehicle_id = v.id
      WHERE r.id = ?
    `,
          )
          .get(reservation.id);

        if (!createdReservation) {
          return res.status(500).json({
            success: false,
            error: 'Erreur lors de la récupération de la réservation créée',
          });
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
          linkedEventIds: createdReservation.linked_event_ids
            ? JSON.parse(createdReservation.linked_event_ids)
            : [],
          googleDriveLink: createdReservation.google_drive_link || '',
          rentalPrice,
          isRental: !!(vehicleForPrice && vehicleForPrice.is_location),
        };

        // [SA migration] Sync bidirectionnel OAuth supprimé — Google Calendar géré via Service Account (googleRoutes.js)

        // Alerte email aux admins
        alertReservationCreated(db, mappedReservation, req.user.name).catch((err) =>
          logger.warn('Email alerte réservation échoué:', err.message),
        );

        invalidateEntity('reservations');
        invalidateEntity('affaires');
        res.json(mappedReservation);
      } catch (error) {
        logger.error(error);
        res.status(500).json({ success: false, error: 'Erreur serveur interne' });
      }
    },
  );

  app.put(
    '/api/reservations/:id',
    authenticateToken,
    requireNotReadOnly,
    validate(reservationSchema),
    async (req, res) => {
      try {
        const reservation = req.body;

        // Préserver les liens Google Drive existants (gérés uniquement via PATCH depuis EventDetailsModal)
        const existing = db
          .prepare('SELECT google_drive_link FROM reservations WHERE id = ?')
          .get(req.params.id);
        const existingDriveLink = existing ? existing.google_drive_link : '';

        // Recalculer le prix de location
        const vehicleId = reservation.vehicleId || reservation.vehicle_id;
        const vehicleForPrice = db.prepare('SELECT * FROM vehicles WHERE id = ?').get(vehicleId);
        const rentalPrice = calculateRentalPrice(
          vehicleForPrice,
          reservation.date || reservation.start_date,
          reservation.period || reservation.start_period || 'AM',
          reservation.endDate || reservation.end_date,
          reservation.endPeriod || reservation.end_period || 'PM',
        );

        const stmt = db.prepare(`
      UPDATE reservations 
      SET vehicle_id = ?, start_date = ?, start_period = ?, end_date = ?, end_period = ?,
          client_name = ?, driver_name = ?, location_name = ?, prestation_name = ?,
          notes = ?, google_event_id = ?, google_drive_link = ?, affaire = ?, is_tournee = ?, linked_event_ids = ?,
          rental_price = ?,
          modified_by = ?, modified_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);

        stmt.run(
          vehicleId,
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
          reservation.linkedEventIds || reservation.linked_event_ids
            ? JSON.stringify(reservation.linkedEventIds || reservation.linked_event_ids)
            : null,
          rentalPrice,
          req.user.id,
          req.params.id,
        );

        addToHistory(
          'reservation',
          req.params.id,
          'updated',
          reservation,
          req.user.id,
          req.user.name,
        );

        // Sync eM@g -> Google (best effort). N'empêche pas la mise à jour locale.
        try {
          const _updatedReservation = db
            .prepare(
              `
        SELECT r.*, v.name AS vehicle_name
        FROM reservations r
        LEFT JOIN vehicles v ON v.id = r.vehicle_id
        WHERE r.id = ?
      `,
            )
            .get(req.params.id);

          // [SA migration] Sync bidirectionnel OAuth supprimé — Google Calendar géré via Service Account (googleRoutes.js)
        } catch (syncErr) {
          logger.warn('Sync Google réservation (update) ignorée:', syncErr.message);
        }

        invalidateEntity('reservations');
        invalidateEntity('affaires');

        const saved = db.prepare('SELECT * FROM reservations WHERE id = ?').get(req.params.id);
        res.json({ success: true, ...(saved || {}) });
      } catch (error) {
        logger.error(error);
        res.status(500).json({ success: false, error: 'Erreur serveur interne' });
      }
    },
  );

  // Mise à jour partielle d'une réservation (liens Google Drive)
  app.patch('/api/reservations/:id', authenticateToken, requireAdmin, (req, res) => {
    try {
      const { google_drive_links, google_drive_link, google_event_id } = req.body;

      // Cas 1 : association/desassociation a un evenement Google
      if (google_event_id !== undefined) {
        const value = google_event_id ? String(google_event_id) : '';
        const existing = db
          .prepare('SELECT linked_event_ids FROM reservations WHERE id = ?')
          .get(req.params.id);
        if (!existing) {
          return res.status(404).json({ success: false, error: 'Réservation introuvable' });
        }
        let linkedIds = [];
        try {
          linkedIds = existing.linked_event_ids ? JSON.parse(existing.linked_event_ids) : [];
          if (!Array.isArray(linkedIds)) linkedIds = [];
        } catch {
          linkedIds = [];
        }
        if (value) {
          if (!linkedIds.includes(value)) linkedIds.push(value);
        } else {
          // Désassociation : on vide aussi linked_event_ids (cas réservation simple)
          linkedIds = [];
        }
        const linkedJson = linkedIds.length > 0 ? JSON.stringify(linkedIds) : null;
        const stmt = db.prepare(`
          UPDATE reservations
          SET google_event_id = ?, linked_event_ids = ?, modified_by = ?, modified_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `);
        stmt.run(value, linkedJson, req.user.id, req.params.id);
        addToHistory(
          'reservation',
          req.params.id,
          'updated',
          { google_event_id: value || null, linked_event_ids: linkedIds },
          req.user.id,
          req.user.name,
        );
        invalidateEntity('reservations');
        return res.json({ success: true, googleEventId: value, linkedEventIds: linkedIds });
      }

      // Cas 2 : liens Google Drive (existant)
      let linksToStore;
      if (google_drive_links !== undefined) {
        // Nouveau format : tableau de {url, label}
        if (!Array.isArray(google_drive_links)) {
          return res
            .status(400)
            .json({ success: false, error: 'google_drive_links doit être un tableau' });
        }
        linksToStore = JSON.stringify(google_drive_links);
      } else if (google_drive_link !== undefined) {
        // Ancien format rétrocompatible : string simple
        linksToStore = google_drive_link || '';
      } else {
        return res.status(400).json({
          success: false,
          error: 'Champ manquant (google_drive_links, google_drive_link ou google_event_id)',
        });
      }

      const stmt = db.prepare(`
      UPDATE reservations SET google_drive_link = ?, modified_by = ?, modified_at = CURRENT_TIMESTAMP WHERE id = ?
    `);
      stmt.run(linksToStore, req.user.id, req.params.id);
      addToHistory(
        'reservation',
        req.params.id,
        'updated',
        { google_drive_links: google_drive_links || google_drive_link },
        req.user.id,
        req.user.name,
      );

      const updatedLinks = parseDriveLinks(linksToStore);
      res.json({ success: true, googleDriveLinks: updatedLinks, googleDriveLink: linksToStore });
    } catch (error) {
      logger.error(error);
      res.status(500).json({ success: false, error: 'Erreur serveur interne' });
    }
  });

  app.delete('/api/reservations/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
      // Vérification existence (cf. AUDIT-MUTATIONS-BACKEND-2026-05-18 §4.1)
      const existing = db
        .prepare('SELECT google_event_id FROM reservations WHERE id = ?')
        .get(req.params.id);
      if (!existing)
        return res.status(404).json({ success: false, error: 'Réservation non trouvée' });

      const stmt = db.prepare('DELETE FROM reservations WHERE id = ?');
      stmt.run(req.params.id);

      addToHistory('reservation', req.params.id, 'deleted', null, req.user.id, req.user.name);

      // [SA migration] Sync bidirectionnel OAuth supprimé — Google Calendar géré via Service Account (googleRoutes.js)

      invalidateEntity('reservations');
      invalidateEntity('affaires');

      res.json({ success: true });
    } catch (error) {
      logger.error(error);
      res.status(500).json({ success: false, error: 'Erreur serveur interne' });
    }
  });

  // ============ DEMANDES DE RÉSERVATION ============

  app.get('/api/reservation-requests', authenticateToken, (req, res) => {
    try {
      // Admins see all requests, regular users see only their own
      const isAdmin = req.user && req.user.isAdmin;
      let requests;
      if (isAdmin) {
        requests = db
          .prepare(
            `
        SELECT rr.*, u.name as requester_name, u.email as requester_email
        FROM reservation_requests rr
        LEFT JOIN users u ON rr.requested_by = u.id
        ORDER BY rr.requested_at DESC
      `,
          )
          .all();
      } else {
        requests = db
          .prepare(
            `
        SELECT rr.*, u.name as requester_name, u.email as requester_email
        FROM reservation_requests rr
        LEFT JOIN users u ON rr.requested_by = u.id
        WHERE rr.requested_by = ?
        ORDER BY rr.requested_at DESC
      `,
          )
          .all(req.user.id);
      }
      res.json(requests);
    } catch (error) {
      logger.error(error);
      res.status(500).json({ success: false, error: 'Erreur serveur interne' });
    }
  });

  app.post(
    '/api/reservation-requests',
    authenticateToken,
    validate(reservationRequestSchema),
    (req, res) => {
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
          req.user.id,
        );

        res.status(201).json({ success: true, id: request.id });
      } catch (error) {
        logger.error(error);
        res.status(500).json({ success: false, error: 'Erreur serveur interne' });
      }
    },
  );

  app.put('/api/reservation-requests/:id/approve', authenticateToken, (req, res) => {
    try {
      // Vérifier que l'utilisateur est admin
      const userStmt = db.prepare('SELECT is_admin FROM users WHERE id = ?');
      const user = userStmt.get(req.user.id);

      if (!user || !user.is_admin) {
        return res.status(403).json({ success: false, error: 'Accès réservé aux administrateurs' });
      }

      // Récupérer la demande
      const requestStmt = db.prepare('SELECT * FROM reservation_requests WHERE id = ?');
      const request = requestStmt.get(req.params.id);

      if (!request) {
        return res.status(404).json({ success: false, error: 'Demande introuvable' });
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
          conflicts: conflicts.map((c) => ({
            id: c.id,
            start_date: c.start_date,
            end_date: c.end_date,
            client_name: c.client_name,
          })),
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
        req.user.id,
      );

      // Mettre à jour le statut de la demande
      const updateStmt = db.prepare(`
      UPDATE reservation_requests 
      SET status = 'approved', reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
      updateStmt.run(req.user.id, req.params.id);

      addToHistory(
        'reservation_request',
        req.params.id,
        'approved',
        request,
        req.user.id,
        req.user.name,
      );

      const saved = db
        .prepare('SELECT * FROM reservation_requests WHERE id = ?')
        .get(req.params.id);
      res.json({ success: true, ...(saved || {}) });
    } catch (error) {
      logger.error(error);
      res.status(500).json({ success: false, error: 'Erreur serveur interne' });
    }
  });

  app.put('/api/reservation-requests/:id/reject', authenticateToken, (req, res) => {
    try {
      // Vérifier que l'utilisateur est admin
      const userStmt = db.prepare('SELECT is_admin FROM users WHERE id = ?');
      const user = userStmt.get(req.user.id);

      if (!user || !user.is_admin) {
        return res.status(403).json({ success: false, error: 'Accès réservé aux administrateurs' });
      }

      // Vérification existence (cf. AUDIT-MUTATIONS-BACKEND-2026-05-18 §4.1)
      const existing = db
        .prepare('SELECT id FROM reservation_requests WHERE id = ?')
        .get(req.params.id);
      if (!existing)
        return res
          .status(404)
          .json({ success: false, error: 'Demande de réservation non trouvée' });

      const updateStmt = db.prepare(`
      UPDATE reservation_requests 
      SET status = 'rejected', reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP, rejection_reason = ?
      WHERE id = ?
    `);
      updateStmt.run(req.user.id, req.body.reason || '', req.params.id);

      addToHistory(
        'reservation_request',
        req.params.id,
        'rejected',
        { reason: req.body.reason },
        req.user.id,
        req.user.name,
      );

      const saved = db
        .prepare('SELECT * FROM reservation_requests WHERE id = ?')
        .get(req.params.id);
      res.json({ success: true, ...(saved || {}) });
    } catch (error) {
      logger.error(error);
      res.status(500).json({ success: false, error: 'Erreur serveur interne' });
    }
  });

  // ============ MAINTENANCES ============

  app.get(
    '/api/maintenances',
    authenticateToken,
    cacheMiddleware(listCache, () => 'maintenances', 30_000),
    (req, res) => {
      try {
        const stmt = db.prepare(`
      SELECT m.*, u.name as creator_name 
      FROM maintenances m 
      LEFT JOIN users u ON m.created_by = u.id
    `);
        const maintenances = stmt.all();

        // Mapper snake_case vers camelCase pour compatibilité frontend
        const mappedMaintenances = maintenances.map((m) => ({
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
          modifiedAt: m.modified_at,
        }));

        res.json(mappedMaintenances);
      } catch (error) {
        logger.error(error);
        res.status(500).json({ success: false, error: 'Erreur serveur interne' });
      }
    },
  );

  app.post('/api/maintenances', authenticateToken, validate(maintenanceSchema), (req, res) => {
    try {
      const maintenance = req.body;

      // Vérifier permissions (admin, can_manage_vehicle_maintenance ou legacy can_manage_maintenance)
      const canFullAccess = hasMaintenanceFullAccess(req.user.id, req.user.isAdmin);

      // Les utilisateurs sans permission ne peuvent créer que des signalements
      if (!canFullAccess && maintenance.status !== 'reported') {
        return res.status(403).json({
          error: 'Accès refusé',
          message:
            'Vous ne pouvez que signaler des pannes. Pour programmer une intervention, contactez un administrateur.',
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
      const resolvedDate =
        maintenance.start_date || maintenance.startDate || maintenance.date || null;
      const resolvedEndDate = maintenance.end_date || maintenance.endDate || resolvedDate;

      const createMaintenance = db.transaction(() => {
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
          req.user.id,
        );

        addToHistory(
          'maintenance',
          maintenance.id,
          'created',
          maintenance,
          req.user.id,
          req.user.name,
        );

        const veh = db
          .prepare('SELECT kilometrage, name FROM vehicles WHERE id = ?')
          .get(maintenance.vehicle_id);

        // Si un kilométrage est renseigné, mettre à jour le véhicule et ajouter un relevé dans l'historique
        if (maintenance.mileage && parseInt(maintenance.mileage, 10) > 0) {
          const vehicleId = maintenance.vehicle_id;
          const newKm = parseInt(maintenance.mileage, 10);
          const oldKm = veh ? veh.kilometrage || 0 : 0;

          if (newKm !== oldKm) {
            db.prepare(
              'UPDATE vehicles SET kilometrage = ?, modified_by = ?, modified_at = CURRENT_TIMESTAMP WHERE id = ?',
            ).run(newKm, req.user.id, vehicleId);

            addToHistory(
              'vehicle',
              vehicleId,
              'mileage_update',
              JSON.stringify({
                description: 'Relevé kilométrique (maintenance)',
                oldKilometrage: oldKm,
                newKilometrage: newKm,
                maintenanceId: maintenance.id,
                vehicleName: veh?.name || '',
                date: new Date().toISOString(),
              }),
              req.user.id,
              req.user.name,
            );
          }
        }

        return veh?.name || 'Véhicule inconnu';
      });

      const vehicleName = createMaintenance();

      // Alerte email maintenance / contrôle technique (best-effort hors transaction)
      try {
        alertMaintenanceCreated(db, maintenance, vehicleName, req.user.name);
      } catch (emailErr) {
        logger.warn('Alerte email maintenance:', emailErr.message);
      }

      invalidateEntity('maintenances');
      res.status(201).json({ success: true, id: maintenance.id });
    } catch (error) {
      logger.error(error);
      res.status(500).json({ success: false, error: 'Erreur serveur interne' });
    }
  });

  app.put('/api/maintenances/:id', authenticateToken, validate(maintenanceSchema), (req, res) => {
    try {
      const maintenance = req.body;

      // Vérifier permissions (can_manage_vehicle_maintenance ou legacy can_manage_maintenance)
      const canFullAccess = hasMaintenanceFullAccess(req.user.id, req.user.isAdmin);

      // Utilisateurs avec permission maintenance = accès complet, sinon restrictions
      if (!canFullAccess) {
        const existing = db
          .prepare('SELECT created_by, status FROM maintenances WHERE id = ?')
          .get(req.params.id);

        if (!existing) {
          return res.status(404).json({ success: false, error: 'Maintenance introuvable' });
        }

        // Les non-autorisés peuvent uniquement modifier leurs propres signalements
        if (existing.created_by !== req.user.id) {
          return res.status(403).json({
            error: 'Accès refusé',
            message: 'Vous ne pouvez modifier que vos propres signalements.',
          });
        }

        // Autoriser uniquement la clôture de son propre signalement pour les non-autorisés.
        const wantsStatusChange = maintenance.status !== existing.status;
        const isOwnClosureAllowed =
          maintenance.status === 'completed' &&
          (existing.status === 'reported' || existing.status === 'pending');

        if (wantsStatusChange && !isOwnClosureAllowed) {
          return res.status(403).json({
            error: 'Accès refusé',
            message:
              'Seuls les administrateurs peuvent changer le statut, sauf clôture de votre propre signalement.',
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
      const resolvedDate =
        maintenance.startDate || maintenance.start_date || maintenance.date || null;
      const resolvedEndDate = maintenance.endDate || maintenance.end_date || resolvedDate;

      const updateMaintenance = db.transaction(() => {
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
          req.params.id,
        );

        // Si l'intervention est de type technical_inspection et passe à "completed",
        // mettre à jour la deadline du contrôle technique correspondant
        if (
          maintenance.type === 'technical_inspection' &&
          maintenance.status === 'completed' &&
          (maintenance.technicalControlType || maintenance.technical_control_type)
        ) {
          const vehicleId = maintenance.vehicleId || maintenance.vehicle_id;
          const controlType =
            maintenance.technicalControlType || maintenance.technical_control_type;
          const completionDate =
            maintenance.endDate ||
            maintenance.end_date ||
            maintenance.startDate ||
            maintenance.date;

          // Récupérer le véhicule pour mettre à jour ses contrôles techniques
          const vehicle = db
            .prepare('SELECT controles_techniques FROM vehicles WHERE id = ?')
            .get(vehicleId);

          if (vehicle) {
            let controles = [];
            try {
              controles = vehicle.controles_techniques
                ? JSON.parse(vehicle.controles_techniques)
                : [];
            } catch (e) {
              logger.error('Erreur parsing controles_techniques:', e);
            }

            // Trouver le contrôle correspondant
            const controleIndex = controles.findIndex((c) => c.type === controlType);

            if (controleIndex >= 0) {
              // Calculer la nouvelle deadline selon le type de contrôle
              const periodicDelays = {
                VL: 24, // 24 mois
                PL: 12, // 12 mois
                SEMI: 12, // 12 mois
                SCENE: 12, // 12 mois
                POLLUTION: 12, // 12 mois
                HAYON: 6, // 6 mois
                TACHYGRAPHE: 24, // 24 mois
                LIMITEUR: 12, // 12 mois
              };

              const delayMonths = periodicDelays[controlType] || 12;
              const date = new Date(completionDate);
              date.setMonth(date.getMonth() + delayMonths);
              const newDeadline = date.toISOString().split('T')[0];

              // Mettre à jour le contrôle
              controles[controleIndex] = {
                ...controles[controleIndex],
                date: completionDate,
                deadline: newDeadline,
              };

              // Sauvegarder les contrôles mis à jour
              const updateStmt = db.prepare(
                'UPDATE vehicles SET controles_techniques = ? WHERE id = ?',
              );
              updateStmt.run(JSON.stringify(controles), vehicleId);

              logger.info(
                `✅ Deadline CT ${controlType} mise à jour pour véhicule ${vehicleId}: ${newDeadline}`,
              );
            }
          }
        }

        addToHistory(
          'maintenance',
          req.params.id,
          'updated',
          maintenance,
          req.user.id,
          req.user.name,
        );

        // Si un kilométrage est renseigné, mettre à jour le véhicule et ajouter un relevé dans l'historique
        if (maintenance.mileage && parseInt(maintenance.mileage, 10) > 0) {
          const vehicleId = maintenance.vehicleId || maintenance.vehicle_id;
          const newKm = parseInt(maintenance.mileage, 10);
          const oldVehicle = db
            .prepare('SELECT kilometrage, name FROM vehicles WHERE id = ?')
            .get(vehicleId);
          const oldKm = oldVehicle ? oldVehicle.kilometrage || 0 : 0;

          if (newKm !== oldKm) {
            db.prepare(
              'UPDATE vehicles SET kilometrage = ?, modified_by = ?, modified_at = CURRENT_TIMESTAMP WHERE id = ?',
            ).run(newKm, req.user.id, vehicleId);

            addToHistory(
              'vehicle',
              vehicleId,
              'mileage_update',
              JSON.stringify({
                description: 'Relevé kilométrique (maintenance)',
                oldKilometrage: oldKm,
                newKilometrage: newKm,
                maintenanceId: req.params.id,
                vehicleName: oldVehicle?.name || '',
                date: new Date().toISOString(),
              }),
              req.user.id,
              req.user.name,
            );
          }
        }

        return db.prepare('SELECT * FROM maintenances WHERE id = ?').get(req.params.id);
      });

      const saved = updateMaintenance();

      invalidateEntity('maintenances');
      res.json({ success: true, ...(saved || {}) });
    } catch (error) {
      logger.error(error);
      res.status(500).json({ success: false, error: 'Erreur serveur interne' });
    }
  });

  app.delete('/api/maintenances/:id', authenticateToken, requireMaintenanceAccess, (req, res) => {
    try {
      // Vérification existence (cf. AUDIT-MUTATIONS-BACKEND-2026-05-18 §4.1)
      const result = db.prepare('DELETE FROM maintenances WHERE id = ?').run(req.params.id);
      if (result.changes === 0)
        return res.status(404).json({ success: false, error: 'Maintenance non trouvée' });

      addToHistory('maintenance', req.params.id, 'deleted', null, req.user.id, req.user.name);
      invalidateEntity('maintenances');

      res.json({ success: true });
    } catch (error) {
      logger.error(error);
      res.status(500).json({ success: false, error: 'Erreur serveur interne' });
    }
  });

  // ============ HISTORIQUE ============

  app.get('/api/history/:entityType/:entityId', authenticateToken, (req, res) => {
    try {
      const history = getHistory(req.params.entityType, req.params.entityId);
      res.json(history);
    } catch (error) {
      logger.error(error);
      res.status(500).json({ success: false, error: 'Erreur serveur interne' });
    }
  });

  // ============ LOCATION — CALCUL PRIX PREVIEW ============

  app.get('/api/rental/calculate-price', authenticateToken, (req, res) => {
    try {
      const { vehicleId, startDate, startPeriod, endDate, endPeriod } = req.query;
      if (!vehicleId || !startDate || !endDate) {
        return res.status(400).json({ error: 'vehicleId, startDate et endDate requis' });
      }
      const vehicle = db.prepare('SELECT * FROM vehicles WHERE id = ?').get(vehicleId);
      if (!vehicle) {
        return res.status(404).json({ error: 'Véhicule introuvable' });
      }
      const price = calculateRentalPrice(
        vehicle,
        startDate,
        startPeriod || 'AM',
        endDate,
        endPeriod || 'PM',
      );
      // Calculer le nombre de jours pour l'affichage
      const start = new Date(startDate);
      const end = new Date(endDate);
      let days = Math.round((end - start) / 86400000);
      if (days === 0) {
        days = (startPeriod || 'AM') === 'AM' && (endPeriod || 'PM') === 'PM' ? 1 : 0.5;
      } else {
        const sf = (startPeriod || 'AM') === 'AM' ? 1 : 0.5;
        const ef = (endPeriod || 'PM') === 'PM' ? 1 : 0.5;
        days = days - 1 + sf + ef;
      }
      res.json({
        price,
        days,
        dailyRate: vehicle.daily_rate || 0,
        weeklyRate: vehicle.weekly_rate || 0,
        monthlyRate: vehicle.monthly_rate || 0,
        isLocation: !!vehicle.is_location,
      });
    } catch (error) {
      logger.error(error);
      res.status(500).json({ success: false, error: 'Erreur serveur interne' });
    }
  });

  // ============ LOCATION — REPORTING ============

  app.get('/api/rental/reporting', authenticateToken, requireAdmin, (req, res) => {
    try {
      const { startDate, endDate } = req.query;

      // Véhicules de location
      const locationVehicles = db
        .prepare(
          'SELECT id, name, type, registration, daily_rate, weekly_rate, monthly_rate FROM vehicles WHERE is_location = 1',
        )
        .all();

      // Filtrer les réservations par période si spécifiée
      let dateFilter = '';
      const params = [];
      if (startDate && endDate) {
        dateFilter = 'AND r.start_date <= ? AND r.end_date >= ?';
        params.push(endDate, startDate);
      }

      // Revenus par véhicule
      const revenueByVehicle = db
        .prepare(
          `
          SELECT v.id, v.name, v.type, v.registration,
                 COUNT(r.id) as reservation_count,
                 COALESCE(SUM(r.rental_price), 0) as total_revenue,
                 MIN(r.start_date) as first_reservation,
                 MAX(r.end_date) as last_reservation
          FROM vehicles v
          LEFT JOIN reservations r ON r.vehicle_id = v.id ${dateFilter}
          WHERE v.is_location = 1
          GROUP BY v.id
          ORDER BY total_revenue DESC
        `,
        )
        .all(...params);

      // Résumé global
      const totals = db
        .prepare(
          `
          SELECT COUNT(r.id) as total_reservations,
                 COALESCE(SUM(r.rental_price), 0) as total_revenue,
                 COUNT(DISTINCT r.vehicle_id) as active_vehicles,
                 COUNT(DISTINCT r.client_name) as unique_clients
          FROM reservations r
          JOIN vehicles v ON r.vehicle_id = v.id
          WHERE v.is_location = 1 ${dateFilter}
        `,
        )
        .get(...params);

      // Top clients
      const topClients = db
        .prepare(
          `
          SELECT r.client_name, COUNT(r.id) as reservation_count,
                 COALESCE(SUM(r.rental_price), 0) as total_spent
          FROM reservations r
          JOIN vehicles v ON r.vehicle_id = v.id
          WHERE v.is_location = 1 AND r.client_name != '' ${dateFilter}
          GROUP BY r.client_name
          ORDER BY total_spent DESC
          LIMIT 10
        `,
        )
        .all(...params);

      // Taux d'occupation (jours réservés vs jours de la période)
      let occupancyData = [];
      if (startDate && endDate) {
        const periodDays = Math.max(
          1,
          Math.round((new Date(endDate) - new Date(startDate)) / 86400000),
        );
        occupancyData = locationVehicles.map((v) => {
          const reservedDays = db
            .prepare(
              `
              SELECT COALESCE(SUM(
                CAST(julianday(MIN(end_date, ?)) - julianday(MAX(start_date, ?)) AS INTEGER) + 1
              ), 0) as days
              FROM reservations
              WHERE vehicle_id = ? AND start_date <= ? AND end_date >= ?
            `,
            )
            .get(endDate, startDate, v.id, endDate, startDate);
          return {
            vehicleId: v.id,
            vehicleName: v.name,
            reservedDays: Math.max(0, reservedDays.days),
            periodDays,
            occupancyRate: Math.round((Math.max(0, reservedDays.days) / periodDays) * 100),
          };
        });
      }

      res.json({
        vehicles: locationVehicles.map((v) => ({
          id: v.id,
          name: v.name,
          type: v.type,
          registration: v.registration,
          dailyRate: v.daily_rate || 0,
          weeklyRate: v.weekly_rate || 0,
          monthlyRate: v.monthly_rate || 0,
        })),
        revenueByVehicle: revenueByVehicle.map((r) => ({
          id: r.id,
          name: r.name,
          type: r.type,
          registration: r.registration,
          reservationCount: r.reservation_count,
          totalRevenue: r.total_revenue,
          firstReservation: r.first_reservation,
          lastReservation: r.last_reservation,
        })),
        totals: {
          totalReservations: totals.total_reservations,
          totalRevenue: totals.total_revenue,
          activeVehicles: totals.active_vehicles,
          uniqueClients: totals.unique_clients,
          vehicleCount: locationVehicles.length,
        },
        topClients: topClients.map((c) => ({
          clientName: c.client_name,
          reservationCount: c.reservation_count,
          totalSpent: c.total_spent,
        })),
        occupancy: occupancyData,
      });
    } catch (error) {
      logger.error(error);
      res.status(500).json({ success: false, error: 'Erreur serveur interne' });
    }
  });

  // ═══ PHOTOS VÉHICULES (galerie /public/Photos) ═══
  const vehiclePhotosDir = join(__dirname, '..', '..', 'public', 'Photos');
  if (!existsSync(vehiclePhotosDir)) mkdirSync(vehiclePhotosDir, { recursive: true });

  const vehiclePhotoStorage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, vehiclePhotosDir),
    filename: (_req, file, cb) => {
      const ext = extname(file.originalname).toLowerCase();
      const baseName = file.originalname
        .replace(/\.[^.]+$/, '')
        .replace(/[^a-zA-Z0-9_\-().]/g, '_');
      let finalName = baseName + ext;
      let counter = 1;
      while (existsSync(join(vehiclePhotosDir, finalName))) {
        finalName = `${baseName}_${counter}${ext}`;
        counter++;
      }
      cb(null, finalName);
    },
  });

  const uploadVehiclePhoto = multer({
    storage: vehiclePhotoStorage,
    limits: { fileSize: 20 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      const allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/avif'];
      if (
        /\.(jpg|jpeg|png|gif|webp|avif)$/i.test(file.originalname) &&
        allowedMimes.includes(file.mimetype)
      ) {
        cb(null, true);
      } else {
        cb(new Error('Format non supporté. Formats acceptés : jpg, png, gif, webp, avif'));
      }
    },
  });

  // GET /api/vehicle-photos — Liste des photos disponibles dans /public/Photos (racine, hors sous-dossiers)
  app.get('/api/vehicle-photos', authenticateToken, (_req, res) => {
    try {
      let photos = [];
      try {
        photos = readdirSync(vehiclePhotosDir, { withFileTypes: true })
          .filter((d) => d.isFile() && /\.(jpg|jpeg|png|gif|webp|avif)$/i.test(d.name))
          .map((d) => d.name)
          .sort((a, b) => a.localeCompare(b));
      } catch (_e) {
        /* dossier absent */
      }
      res.json({ photos });
    } catch (error) {
      logger.error('GET /api/vehicle-photos error:', error);
      res.status(500).json({ success: false, error: 'Erreur serveur interne' });
    }
  });

  // POST /api/vehicle-photos/upload — Upload d'une photo véhicule
  app.post(
    '/api/vehicle-photos/upload',
    authenticateToken,
    uploadVehiclePhoto.single('photo'),
    validateFileTypes(['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/avif']),
    (req, res) => {
      try {
        if (!req.file) {
          return res.status(400).json({ success: false, error: 'Aucun fichier reçu' });
        }
        res.json({ success: true, filename: req.file.filename });
      } catch (error) {
        logger.error('POST /api/vehicle-photos/upload error:', error);
        res.status(500).json({ success: false, error: "Erreur lors de l'upload" });
      }
    },
  );

  // DELETE /api/vehicle-photos/:filename — Supprimer une photo (admin)
  app.delete('/api/vehicle-photos/:filename', authenticateToken, (req, res) => {
    try {
      if (!req.user?.isAdmin) {
        return res.status(403).json({ success: false, error: 'Accès refusé' });
      }
      const filename = decodeURIComponent(req.params.filename);
      if (filename.includes('/') || filename.includes('\\') || filename.includes('..')) {
        return res.status(400).json({ success: false, error: 'Nom de fichier invalide' });
      }
      const filePath = join(vehiclePhotosDir, filename);
      try {
        unlinkSync(filePath);
      } catch (err) {
        if (err.code === 'ENOENT')
          return res.status(404).json({ success: false, error: 'Photo introuvable' });
        throw err;
      }
      db.prepare('UPDATE vehicles SET photo = NULL WHERE photo = ?').run(filename);
      res.json({ success: true, deleted: filename });
    } catch (error) {
      logger.error('DELETE /api/vehicle-photos error:', error);
      res.status(500).json({ success: false, error: 'Erreur lors de la suppression' });
    }
  });
} // end setupVehicleRoutes
