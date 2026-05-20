// reservations.dao — Pilote Phase 1.
// Centralise toutes les requêtes SQL de la table `reservations`.
// Les routes (vehicleRoutes.js) seront migrées une à une vers ce DAO.
//
// Notes :
//   - L'id d'une réservation est une string (`${Date.now()}.${Math.random()}`).
//     On ne s'appuie pas sur lastInsertRowid pour les insertions.
//   - Le mapping camelCase ↔ snake_case est encapsulé ici.

import db from '../database.js';
import { BaseDao } from './_base.dao.js';

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

/**
 * Mappe une ligne SQL `reservations` (jointe ou non) vers la structure attendue par le frontend.
 */
export function mapReservationRow(r) {
  if (!r) return null;
  return {
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
    linkedEventIds: r.linked_event_ids ? safeJsonParse(r.linked_event_ids, null) : null,
    notes: r.notes,
    googleDriveLink: r.google_drive_link || '',
    googleDriveLinks: parseDriveLinks(r.google_drive_link),
    rentalPrice: r.rental_price,
    isRental: r.vehicle_is_location === 1,
    createdBy: r.created_by,
    modifiedBy: r.modified_by,
    createdAt: r.created_at,
    modifiedAt: r.modified_at,
  };
}

function safeJsonParse(raw, fallback) {
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

const SELECT_WITH_VEHICLE = `
  SELECT r.*,
         v.name        AS vehicle_name,
         v.type        AS vehicle_type,
         v.registration AS immatriculation,
         v.is_location AS vehicle_is_location
  FROM reservations r
  LEFT JOIN vehicles v ON r.vehicle_id = v.id
`;

class ReservationsDao extends BaseDao {
  constructor() {
    super('reservations');
  }

  /** Liste complète avec données véhicule. Renvoie tableau de lignes brutes. */
  listWithVehicleRaw() {
    return db.prepare(SELECT_WITH_VEHICLE).all();
  }

  /** Liste mappée camelCase. */
  listMapped() {
    return this.listWithVehicleRaw().map(mapReservationRow);
  }

  /** Une réservation jointe (raw). */
  findByIdWithVehicle(id) {
    return db.prepare(`${SELECT_WITH_VEHICLE} WHERE r.id = ?`).get(id) ?? null;
  }

  /** Une réservation jointe et mappée. */
  findByIdMapped(id) {
    return mapReservationRow(this.findByIdWithVehicle(id));
  }

  /**
   * Crée une réservation. `payload` est en snake_case. `id` doit être fourni (string).
   * Retourne la ligne mappée.
   */
  create(payload, { rentalPrice = null, userId = null } = {}) {
    const stmt = db.prepare(`
      INSERT INTO reservations (
        id, vehicle_id, start_date, start_period, end_date, end_period,
        client_name, driver_name, location_name, prestation_name,
        notes, google_event_id, google_drive_link, affaire, is_tournee, linked_event_ids,
        rental_price, created_by, modified_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      payload.id,
      payload.vehicle_id,
      payload.start_date,
      payload.start_period || 'AM',
      payload.end_date,
      payload.end_period || 'PM',
      payload.client_name || '',
      payload.driver_name || '',
      payload.location_name || '',
      payload.prestation_name || '',
      payload.notes || '',
      payload.google_event_id || '',
      payload.google_drive_link || '',
      payload.affaire || '',
      payload.is_tournee ? 1 : 0,
      payload.linked_event_ids ? JSON.stringify(payload.linked_event_ids) : null,
      rentalPrice,
      userId,
      userId,
    );
    return this.findByIdMapped(payload.id);
  }

  /**
   * Met à jour tous les champs principaux. Le champ google_drive_link n'est PAS modifié ici
   * (géré par updateDriveLink) — on conserve la valeur existante explicitement passée.
   */
  updateFull(id, fields, { rentalPrice = null, userId = null, existingDriveLink = '' } = {}) {
    const stmt = db.prepare(`
      UPDATE reservations
      SET vehicle_id = ?, start_date = ?, start_period = ?, end_date = ?, end_period = ?,
          client_name = ?, driver_name = ?, location_name = ?, prestation_name = ?,
          notes = ?, google_event_id = ?, google_drive_link = ?, affaire = ?, is_tournee = ?,
          linked_event_ids = ?, rental_price = ?,
          modified_by = ?, modified_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    const info = stmt.run(
      fields.vehicle_id,
      fields.start_date,
      fields.start_period || 'AM',
      fields.end_date,
      fields.end_period || 'PM',
      fields.client_name || '',
      fields.driver_name || '',
      fields.location_name || '',
      fields.prestation_name || '',
      fields.notes || '',
      fields.google_event_id || '',
      existingDriveLink || '',
      fields.affaire || '',
      fields.is_tournee ? 1 : 0,
      fields.linked_event_ids ? JSON.stringify(fields.linked_event_ids) : null,
      rentalPrice,
      userId,
      id,
    );
    return { changes: info.changes };
  }

  /** PATCH ciblé du lien Google Drive. */
  updateDriveLink(id, driveLink, userId = null) {
    const info = db
      .prepare(
        `UPDATE reservations
         SET google_drive_link = ?, modified_by = ?, modified_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
      )
      .run(driveLink || '', userId, id);
    return { changes: info.changes };
  }

  /** PATCH ciblé des linked_event_ids (tournées). */
  updateLinkedEventIds(id, linkedIds, userId = null) {
    const info = db
      .prepare(
        `UPDATE reservations
         SET linked_event_ids = ?, modified_by = ?, modified_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
      )
      .run(linkedIds ? JSON.stringify(linkedIds) : null, userId, id);
    return { changes: info.changes };
  }

  /** Lit uniquement le google_drive_link (utilisé pour préserver lors d'un PUT). */
  getDriveLink(id) {
    const row = db.prepare('SELECT google_drive_link FROM reservations WHERE id = ?').get(id);
    return row ? row.google_drive_link || '' : '';
  }

  /** Lit le google_event_id (utilisé avant suppression côté Google). */
  getGoogleEventId(id) {
    const row = db.prepare('SELECT google_event_id FROM reservations WHERE id = ?').get(id);
    return row ? row.google_event_id || null : null;
  }

  /** Lit linked_event_ids (parsé). */
  getLinkedEventIds(id) {
    const row = db.prepare('SELECT linked_event_ids FROM reservations WHERE id = ?').get(id);
    if (!row || !row.linked_event_ids) return null;
    return safeJsonParse(row.linked_event_ids, null);
  }

  /**
   * Détecte les chevauchements pour un véhicule sur une période donnée.
   *
   * On se base sur le *jour* (start_date / end_date au format YYYY-MM-DD) ET
   * sur la période demi-journée (AM/PM). Conflit si la nouvelle plage et une
   * plage existante ont au moins une demi-journée commune.
   *
   * @param {object} args
   * @param {string|number} args.vehicleId
   * @param {string} args.startDate — YYYY-MM-DD
   * @param {'AM'|'PM'} [args.startPeriod='AM']
   * @param {string} args.endDate — YYYY-MM-DD
   * @param {'AM'|'PM'} [args.endPeriod='PM']
   * @param {string} [args.excludeId] — id de réservation à exclure (cas UPDATE)
   * @returns {Array<{id,start_date,start_period,end_date,end_period,client_name}>}
   */
  findOverlapping({
    vehicleId,
    startDate,
    startPeriod = 'AM',
    endDate,
    endPeriod = 'PM',
    excludeId = null,
  }) {
    if (!vehicleId || !startDate || !endDate) return [];

    // Encodage rapide d'une demi-journée en entier comparable :
    // jour * 2 + (PM ? 1 : 0). Compatible SQLite via expressions arithmétiques.
    const toSlot = (d, p) => {
      const day = String(d).slice(0, 10);
      // YYYY-MM-DD → entier YYYYMMDD * 2 (+ 1 si PM)
      const compact = Number(day.replace(/-/g, ''));
      if (!Number.isFinite(compact)) return null;
      return compact * 2 + (p === 'PM' ? 1 : 0);
    };

    const newStart = toSlot(startDate, startPeriod);
    const newEnd = toSlot(endDate, endPeriod);
    if (newStart == null || newEnd == null) return [];

    // Comparaison côté JS (les volumes de réservations par véhicule sont faibles)
    // pour éviter des subtilités SQL liées aux chaînes de format.
    const rows = db
      .prepare(
        `SELECT id, start_date, start_period, end_date, end_period, client_name
         FROM reservations
         WHERE vehicle_id = ?`,
      )
      .all(vehicleId);

    return rows.filter((r) => {
      if (excludeId != null && String(r.id) === String(excludeId)) return false;
      const existingStart = toSlot(r.start_date, r.start_period || 'AM');
      const existingEnd = toSlot(
        r.end_date || r.start_date,
        r.end_period || r.start_period || 'PM',
      );
      if (existingStart == null || existingEnd == null) return false;
      return Math.max(newStart, existingStart) <= Math.min(newEnd, existingEnd);
    });
  }
}

export const reservationsDao = new ReservationsDao();
export default reservationsDao;
