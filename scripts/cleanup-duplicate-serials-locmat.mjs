#!/usr/bin/env node
/**
 * Nettoie les doublons d'unités sérialisées créés par les anciens imports
 * LocMat (avant le fix locmatImportRoutes / coreSerial-aware).
 *
 * Détection :
 *   - On parcourt toutes les lignes `equipment` actives avec serial_number.
 *   - On parse chaque serial_number via parseMagSerial → coreSerial.
 *   - On groupe par coreSerial.
 *   - Si > 1 ligne pour un même coreSerial :
 *       • on garde la ligne dont serial_number === coreSerial (format propre)
 *         et numero_mag est renseigné — typiquement la ligne créée récemment
 *         lors du dernier import (ex: "I14", serial_number "2115080074074").
 *       • on soft-delete les autres (en général les lignes "legacy" dont
 *         serial_number contient encore le MAG, ex: "VX14 - 2115080074074").
 *
 * Sécurité :
 *   - Dry-run par défaut. Passer --apply pour exécuter le soft-delete.
 *   - Aucune suppression hard. Tout ce qui est désactivé peut être réactivé
 *     manuellement via UPDATE equipment SET status='available' WHERE id=?.
 *
 * Usage :
 *   node scripts/cleanup-duplicate-serials-locmat.mjs              # dry-run
 *   node scripts/cleanup-duplicate-serials-locmat.mjs --apply      # exécute
 *   node scripts/cleanup-duplicate-serials-locmat.mjs --reference=VIPER  # filtre
 */

import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import Database from 'better-sqlite3';

import { parseMagSerial } from '../apps/api/services/magNumber.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_FILENAME = process.env.DB_PATH || 'vehicules.db';
const dbPath = join(__dirname, '..', 'apps', 'api', DB_FILENAME);

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const REFERENCE_FILTER = (() => {
  const arg = args.find((a) => a.startsWith('--reference='));
  return arg ? arg.split('=')[1].toUpperCase() : null;
})();

const db = new Database(dbPath);
db.pragma('foreign_keys = ON');

const rows = db
  .prepare(
    `SELECT id, reference, serial_number, numero_mag, name, status, created_at, updated_at
     FROM equipment
     WHERE serial_number IS NOT NULL AND serial_number != ''
       AND (status IS NULL OR status != 'removed')
     ORDER BY id`,
  )
  .all();

// Grouper par (refUpper, coreSerial)
const groups = new Map();
for (const r of rows) {
  if (REFERENCE_FILTER && String(r.reference || '').toUpperCase() !== REFERENCE_FILTER) continue;
  const { coreSerial } = parseMagSerial(r.serial_number);
  const core = coreSerial || r.serial_number;
  const key = `${String(r.reference || '').toUpperCase()}|||${core}`;
  if (!groups.has(key)) groups.set(key, []);
  groups.get(key).push({ ...r, coreSerial: core });
}

const duplicates = [...groups.entries()].filter(([, list]) => list.length > 1);

console.log('═══════════════════════════════════════════════════════════════');
console.log('Nettoyage doublons sérialisés LocMat');
console.log('Mode :', APPLY ? 'APPLY (soft-delete)' : 'DRY-RUN (lecture seule)');
if (REFERENCE_FILTER) console.log('Filtre référence :', REFERENCE_FILTER);
console.log('DB :', dbPath);
console.log('Lignes actives avec serial_number :', rows.length);
console.log('Groupes en doublon (même reference + coreSerial) :', duplicates.length);
console.log('═══════════════════════════════════════════════════════════════');

if (duplicates.length === 0) {
  console.log('Aucun doublon détecté.');
  db.close();
  process.exit(0);
}

// Heuristique : on garde la ligne qui a (a) serial_number propre (= coreSerial)
// ET (b) numero_mag renseigné. À défaut : la plus récente par id.
function pickKeeper(list) {
  // 1) lignes propres + numero_mag
  const clean = list.filter(
    (r) => r.serial_number === r.coreSerial && r.numero_mag && r.numero_mag.trim() !== '',
  );
  if (clean.length > 0) return clean.sort((a, b) => b.id - a.id)[0];
  // 2) lignes propres
  const cleanOnly = list.filter((r) => r.serial_number === r.coreSerial);
  if (cleanOnly.length > 0) return cleanOnly.sort((a, b) => b.id - a.id)[0];
  // 3) plus récente
  return list.sort((a, b) => b.id - a.id)[0];
}

const softDelete = db.prepare(
  `UPDATE equipment SET status = 'removed', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
);

let toRemove = 0;
let removed = 0;

const tx = db.transaction(() => {
  for (const [key, list] of duplicates) {
    const keeper = pickKeeper(list);
    const losers = list.filter((r) => r.id !== keeper.id);
    const [ref, core] = key.split('|||');
    console.log(`\n[${ref}] coreSerial=${core}  (${list.length} lignes)`);
    console.log(
      `  KEEP  #${keeper.id}  mag=${keeper.numero_mag || '∅'}  sn="${keeper.serial_number}"  status=${keeper.status}`,
    );
    for (const l of losers) {
      console.log(
        `  DROP  #${l.id}  mag=${l.numero_mag || '∅'}  sn="${l.serial_number}"  status=${l.status}`,
      );
      toRemove++;
      if (APPLY) {
        const info = softDelete.run(l.id);
        if (info.changes > 0) removed++;
      }
    }
  }
});

tx();

console.log('\n═══════════════════════════════════════════════════════════════');
console.log(`Lignes à supprimer (soft) : ${toRemove}`);
if (APPLY) {
  console.log(`Lignes effectivement passées à status='removed' : ${removed}`);
} else {
  console.log('Dry-run terminé. Relance avec --apply pour appliquer.');
}
console.log('═══════════════════════════════════════════════════════════════');

db.close();
