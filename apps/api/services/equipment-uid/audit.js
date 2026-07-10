// apps/api/services/equipment-uid/audit.js
//
// Ticket : T-P1-06 (Equipements v2 - UID / serials controles).
//
// Audit read-only du domaine UID + serials. Utilise pour :
//   - detecter les doublons serial_number (bloque le renforcement
//     UNIQUE prevu en T-P1-06b, tant que non 0),
//   - detecter les equipments sans UID (a corriger via
//     regenerate),
//   - detecter les collisions UID entre equipment et
//     equipment_serials (deja audite par la migration UID v2,
//     redondance defensive).

import { EquipmentUidV2ValidationError } from './errors.js';

/**
 * @param {import('better-sqlite3').Database} db
 * @returns {{
 *   equipment_total: number,
 *   equipment_with_uid: number,
 *   equipment_without_uid: number,
 *   equipment_with_serial: number,
 *   duplicate_serials: Array<{ serial_number: string, count: number, ids: number[] }>,
 *   duplicate_uids: Array<{ uid: string, count: number, ids: number[] }>,
 *   verdict: string,
 * }}
 */
export function auditUidState(db) {
  if (!db) throw new EquipmentUidV2ValidationError('db requis');

  const total = db.prepare('SELECT COUNT(*) AS n FROM equipment').get().n;
  const withUid = db
    .prepare("SELECT COUNT(*) AS n FROM equipment WHERE uid IS NOT NULL AND uid != ''")
    .get().n;
  const withSerial = db
    .prepare(
      "SELECT COUNT(*) AS n FROM equipment WHERE serial_number IS NOT NULL AND serial_number != ''",
    )
    .get().n;

  const duplicateSerialsRows = db
    .prepare(
      `SELECT serial_number, COUNT(*) AS n, GROUP_CONCAT(id) AS ids
       FROM equipment
       WHERE serial_number IS NOT NULL AND serial_number != ''
       GROUP BY serial_number
       HAVING n > 1
       ORDER BY n DESC, serial_number`,
    )
    .all();
  const duplicateSerials = duplicateSerialsRows.map((r) => ({
    serial_number: r.serial_number,
    count: r.n,
    ids: String(r.ids)
      .split(',')
      .map((s) => Number(s))
      .filter((n) => Number.isInteger(n)),
  }));

  const duplicateUidsRows = db
    .prepare(
      `SELECT uid, COUNT(*) AS n, GROUP_CONCAT(id) AS ids
       FROM equipment
       WHERE uid IS NOT NULL AND uid != ''
       GROUP BY uid
       HAVING n > 1
       ORDER BY n DESC, uid`,
    )
    .all();
  const duplicateUids = duplicateUidsRows.map((r) => ({
    uid: r.uid,
    count: r.n,
    ids: String(r.ids)
      .split(',')
      .map((s) => Number(s))
      .filter((n) => Number.isInteger(n)),
  }));

  const withoutUid = total - withUid;
  let verdict;
  if (duplicateSerials.length === 0 && duplicateUids.length === 0 && withoutUid === 0) {
    verdict = 'OK — schema sain, renforcement UNIQUE safe (T-P1-06b)';
  } else {
    const issues = [];
    if (duplicateSerials.length > 0)
      issues.push(`${duplicateSerials.length} doublons serial_number`);
    if (duplicateUids.length > 0) issues.push(`${duplicateUids.length} doublons uid`);
    if (withoutUid > 0) issues.push(`${withoutUid} equipments sans uid`);
    verdict = `${issues.join(', ')} — regenerate + investigation avant sunset UNIQUE`;
  }

  return {
    equipment_total: total,
    equipment_with_uid: withUid,
    equipment_without_uid: withoutUid,
    equipment_with_serial: withSerial,
    duplicate_serials: duplicateSerials,
    duplicate_uids: duplicateUids,
    verdict,
  };
}
