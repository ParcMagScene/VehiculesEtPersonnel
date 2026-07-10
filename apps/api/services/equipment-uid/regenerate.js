// apps/api/services/equipment-uid/regenerate.js
//
// Ticket : T-P1-06 (Equipements v2 - UID / serials controles).
//
// Regenere un UID EMAG-XXXXX pour un equipment donne. Utilise le
// helper `getNextUid` (services/uidCounter.js) qui garantit
// l'unicite + increment atomique du compteur. Ecrit l'ancien UID
// dans `equipment.notes` pour audit trace (approche minimalement
// invasive : pas de nouvelle table history dediee dans ce ticket).

import { getNextUid } from '../uidCounter.js';
import {
  EquipmentUidV2ConflictError,
  EquipmentUidV2NotFoundError,
  EquipmentUidV2ValidationError,
} from './errors.js';

/**
 * @param {object} params
 * @param {import('better-sqlite3').Database} params.db
 * @param {number} params.equipmentId
 * @param {number|null} [params.regeneratedBy] User id pour audit.
 * @param {string|null} [params.reason] Motif humain (optionnel).
 * @returns {{
 *   equipment_id: number,
 *   previous_uid: string|null,
 *   new_uid: string,
 *   regenerated_by: number|null,
 *   regenerated_at: string,
 * }}
 * @throws {EquipmentUidV2ValidationError} si equipmentId invalide.
 * @throws {EquipmentUidV2NotFoundError} si equipment absent.
 * @throws {EquipmentUidV2ConflictError} si le nouveau UID collision
 *   (getNextUid protege deja contre ca, mais on double-check ici).
 */
export function regenerateEquipmentUid({
  db,
  equipmentId,
  regeneratedBy = null,
  reason = null,
} = {}) {
  if (!db) throw new EquipmentUidV2ValidationError('db requis');
  const id = Number(equipmentId);
  if (!Number.isInteger(id) || id <= 0) {
    throw new EquipmentUidV2ValidationError('equipmentId doit etre un entier > 0');
  }

  const current = db.prepare('SELECT id, uid, name, notes FROM equipment WHERE id = ?').get(id);
  if (!current) {
    throw new EquipmentUidV2NotFoundError(`Equipment introuvable (id=${id})`, { equipmentId: id });
  }

  const newUid = getNextUid(db);
  if (newUid === current.uid) {
    // Ne devrait pas arriver — getNextUid increment le compteur.
    throw new EquipmentUidV2ConflictError('Le nouveau UID est identique a l ancien', {
      uid: newUid,
    });
  }

  const nowIso = new Date().toISOString();
  const auditLine = `[UID-REGEN ${nowIso}] ${current.uid ?? '(vide)'} -> ${newUid}${
    reason ? ` — ${reason}` : ''
  }${regeneratedBy ? ` (by user #${regeneratedBy})` : ''}`;
  const newNotes = current.notes ? `${current.notes}\n${auditLine}` : auditLine;

  db.prepare(
    "UPDATE equipment SET uid = ?, notes = ?, updated_at = datetime('now') WHERE id = ?",
  ).run(newUid, newNotes, id);

  return {
    equipment_id: id,
    previous_uid: current.uid ?? null,
    new_uid: newUid,
    regenerated_by: regeneratedBy ?? null,
    regenerated_at: nowIso,
  };
}
