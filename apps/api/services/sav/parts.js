// apps/api/services/sav/parts.js
//
// Ticket : T-P1-07. Services CRUD sur `sav_parts`.

import { SavV2NotFoundError, SavV2ValidationError } from './errors.js';

/**
 * Statuts valides d'une piece (aligne migration).
 * @type {ReadonlyArray<string>}
 */
export const SAV_PART_STATUSES = Object.freeze([
  'requested',
  'ordered',
  'received',
  'installed',
  'cancelled',
]);

/**
 * @param {import('better-sqlite3').Database} db
 * @param {number} ticketId
 * @returns {{ parts: object[], total: number }}
 */
export function listPartsForTicket({ db, ticketId } = {}) {
  if (!db) throw new SavV2ValidationError('db requis');
  const id = Number(ticketId);
  if (!Number.isInteger(id) || id <= 0) {
    throw new SavV2ValidationError('ticketId doit etre un entier > 0');
  }
  const rows = db
    .prepare(
      `SELECT id, ticket_id, part_name, part_reference, quantity, unit_price,
              supplier, status, requested_at, ordered_at, received_at,
              installed_at, cancelled_at, notes, created_by, created_at,
              modified_by, modified_at
       FROM sav_parts
       WHERE ticket_id = ?
       ORDER BY requested_at DESC, id DESC`,
    )
    .all(id);
  return { parts: rows, total: rows.length };
}

/**
 * @param {object} params
 * @param {import('better-sqlite3').Database} params.db
 * @param {number} params.ticketId
 * @param {object} params.data
 * @param {string} params.data.part_name
 * @param {string} [params.data.part_reference]
 * @param {number} [params.data.quantity]
 * @param {number} [params.data.unit_price]
 * @param {string} [params.data.supplier]
 * @param {string} [params.data.notes]
 * @param {number|null} [params.createdBy]
 * @returns {object} La ligne inseree.
 */
export function addPart({ db, ticketId, data, createdBy = null } = {}) {
  if (!db) throw new SavV2ValidationError('db requis');
  const id = Number(ticketId);
  if (!Number.isInteger(id) || id <= 0) {
    throw new SavV2ValidationError('ticketId doit etre un entier > 0');
  }
  const ticket = db.prepare('SELECT id FROM sav_tickets WHERE id = ?').get(id);
  if (!ticket) {
    throw new SavV2NotFoundError(`Ticket SAV introuvable (id=${id})`, { ticketId: id });
  }
  if (!data || typeof data !== 'object') {
    throw new SavV2ValidationError('data requis (objet)');
  }
  const partName = typeof data.part_name === 'string' ? data.part_name.trim() : '';
  if (!partName) {
    throw new SavV2ValidationError('part_name requis');
  }
  const quantity =
    data.quantity === undefined || data.quantity === null || data.quantity === ''
      ? 1
      : Number(data.quantity);
  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new SavV2ValidationError('quantity doit etre un nombre > 0');
  }
  const unitPrice =
    data.unit_price === undefined || data.unit_price === null || data.unit_price === ''
      ? null
      : Number(data.unit_price);
  if (unitPrice !== null && !Number.isFinite(unitPrice)) {
    throw new SavV2ValidationError('unit_price doit etre un nombre');
  }

  const result = db
    .prepare(
      `INSERT INTO sav_parts
         (ticket_id, part_name, part_reference, quantity, unit_price, supplier,
          notes, created_by, modified_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      id,
      partName,
      typeof data.part_reference === 'string' ? data.part_reference.trim() || null : null,
      quantity,
      unitPrice,
      typeof data.supplier === 'string' ? data.supplier.trim() || null : null,
      typeof data.notes === 'string' ? data.notes.trim() || null : null,
      createdBy,
      createdBy,
    );

  return db.prepare('SELECT * FROM sav_parts WHERE id = ?').get(result.lastInsertRowid);
}

/**
 * Change le statut d'une piece + met a jour le timestamp typé
 * associé (`ordered_at`, `received_at`, `installed_at`,
 * `cancelled_at`).
 *
 * @param {object} params
 * @param {import('better-sqlite3').Database} params.db
 * @param {number} params.partId
 * @param {string} params.newStatus
 * @param {number|null} [params.modifiedBy]
 * @returns {object} La ligne mise a jour.
 */
export function updatePartStatus({ db, partId, newStatus, modifiedBy = null } = {}) {
  if (!db) throw new SavV2ValidationError('db requis');
  const id = Number(partId);
  if (!Number.isInteger(id) || id <= 0) {
    throw new SavV2ValidationError('partId doit etre un entier > 0');
  }
  if (!SAV_PART_STATUSES.includes(newStatus)) {
    throw new SavV2ValidationError(`Statut inconnu : ${newStatus}`, {
      allowed: [...SAV_PART_STATUSES],
    });
  }
  const current = db.prepare('SELECT * FROM sav_parts WHERE id = ?').get(id);
  if (!current) {
    throw new SavV2NotFoundError(`Piece SAV introuvable (id=${id})`, { partId: id });
  }

  const timestampCol =
    newStatus === 'ordered'
      ? 'ordered_at'
      : newStatus === 'received'
        ? 'received_at'
        : newStatus === 'installed'
          ? 'installed_at'
          : newStatus === 'cancelled'
            ? 'cancelled_at'
            : null;

  const setClauses = ['status = ?', 'modified_by = ?', "modified_at = datetime('now')"];
  const setValues = [newStatus, modifiedBy];
  if (timestampCol && !current[timestampCol]) {
    setClauses.push(`${timestampCol} = datetime('now')`);
  }
  db.prepare(`UPDATE sav_parts SET ${setClauses.join(', ')} WHERE id = ?`).run(...setValues, id);

  return db.prepare('SELECT * FROM sav_parts WHERE id = ?').get(id);
}
