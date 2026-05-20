// ═══════════════════════════════════════════════════════════════
// scripts/normalize-mag-in-serial.mjs
// Deux opérations sur `equipment` :
//
//   1) Normalisation MAG/SN : nettoie les serial_number qui contiennent encore
//      "<MAG> - " alors que numero_mag est déjà renseigné. On garde l'un et
//      l'autre de chaque côté.
//   2) Détection des doublons : deux lignes equipment ACTIVES qui partagent le
//      même coreSerial (après extraction MAG) sont des doublons legacy. On
//      reporte les groupes, et avec --apply-duplicates on soft-remove la
//      ligne "polluée" (celle dont le serial contient encore le préfixe MAG)
//      quand l'autre côté est propre.
//
// Usage :
//   node scripts/normalize-mag-in-serial.mjs [--db <path>]
//     [--apply]              applique la normalisation MAG/SN
//     [--apply-duplicates]   applique le soft-remove des doublons polluées
//
//   --db défaut : apps/api/vehicules.db
//
// Sans aucun flag d'apply : dry-run pur (rapport uniquement).
// ═══════════════════════════════════════════════════════════════
import Database from 'better-sqlite3';
import path from 'node:path';
import process from 'node:process';

import { parseMagSerial } from '../apps/api/services/magNumber.js';

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const applyDuplicates = args.includes('--apply-duplicates');
const dbIdx = args.indexOf('--db');
const dbPath = dbIdx >= 0 ? args[dbIdx + 1] : path.resolve('apps/api/vehicules.db');

console.log(`[normalize-mag] DB=${dbPath} mode=${apply ? 'APPLY' : 'dry-run'}`);

const db = new Database(dbPath);

const rows = db
  .prepare(
    `SELECT id, serial_number, numero_mag
       FROM equipment
      WHERE numero_mag IS NOT NULL AND numero_mag != ''
        AND serial_number IS NOT NULL AND serial_number != ''
        AND (status IS NULL OR status != 'removed')`,
  )
  .all();

const candidates = [];
for (const r of rows) {
  const det = parseMagSerial(r.serial_number);
  if (det.magNumber && det.magNumber === r.numero_mag && det.coreSerial !== r.serial_number) {
    candidates.push({ id: r.id, from: r.serial_number, to: det.coreSerial, mag: r.numero_mag });
  }
}

console.log(`[normalize-mag] candidats: ${candidates.length} / ${rows.length} lignes scannées`);
for (const c of candidates.slice(0, 30)) {
  console.log(`  id=${c.id}  mag=${c.mag}  "${c.from}"  →  "${c.to}"`);
}
if (candidates.length > 30) console.log(`  … (+${candidates.length - 30} autres)`);

if (!apply) {
  console.log('[normalize-mag] dry-run (pas de modif sur la phase 1).');
} else {
  const upd = db.prepare(
    `UPDATE equipment
        SET serial_number = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND serial_number = ? AND numero_mag = ?`,
  );
  const tx = db.transaction((list) => {
    let changed = 0;
    for (const c of list) {
      const info = upd.run(c.to, c.id, c.from, c.mag);
      changed += info.changes;
    }
    return changed;
  });
  const n = tx(candidates);
  console.log(`[normalize-mag] ${n} ligne(s) mise(s) à jour.`);
}

// ─── 2) Détection de doublons (coreSerial partagé entre 2 lignes actives) ───
console.log('\n[duplicates] Scan des doublons sur coreSerial…');
const activeRows = db
  .prepare(
    `SELECT id, reference, name, serial_number, numero_mag, stock_quantity, status
       FROM equipment
      WHERE serial_number IS NOT NULL AND serial_number != ''
        AND (status IS NULL OR status != 'removed')`,
  )
  .all();

// Index : coreSerial → liste des lignes partageant ce coreSerial.
// On groupe par (reference UPPER, coreSerial) pour limiter aux vrais doublons
// au sein d'une même référence (deux références différentes peuvent avoir
// des serials homonymes — bien que rare en pratique).
const groups = new Map();
for (const r of activeRows) {
  const det = parseMagSerial(r.serial_number);
  const core = det.coreSerial;
  const refKey = String(r.reference || '').toUpperCase();
  const key = `${refKey}|${core}`;
  if (!groups.has(key)) groups.set(key, []);
  groups.get(key).push({ ...r, coreSerial: core, detectedMag: det.magNumber });
}

const duplicateGroups = [...groups.entries()]
  .filter(([, list]) => list.length > 1)
  .map(([key, list]) => ({ key, list }));

console.log(
  `[duplicates] ${duplicateGroups.length} groupe(s) de doublons trouv\u00e9(s) ` +
    `(sur ${activeRows.length} lignes actives).`,
);

const toSoftRemove = []; // { id, serial_number, reason }
for (const { key, list } of duplicateGroups) {
  const [, core] = key.split('|');
  console.log(`\n  coreSerial="${core}"  (${list.length} doublons)`);
  for (const r of list) {
    const hasPrefix = r.detectedMag !== null;
    console.log(
      `    id=${r.id}  ref=${r.reference}  serial="${r.serial_number}"  ` +
        `mag=${r.numero_mag || '\u2014'}  qty=${r.stock_quantity}  ` +
        `${hasPrefix ? '[POLLU\u00c9]' : '[propre]'}`,
    );
  }
  // Candidat à soft-remove : la (ou les) ligne(s) polluée(s), seulement si
  // au moins une ligne propre existe dans le même groupe.
  const cleanLines = list.filter((r) => r.detectedMag === null);
  const dirtyLines = list.filter((r) => r.detectedMag !== null);
  if (cleanLines.length >= 1 && dirtyLines.length >= 1) {
    for (const d of dirtyLines) {
      toSoftRemove.push({
        id: d.id,
        serial_number: d.serial_number,
        reason: `doublon legacy de coreSerial=${core} (ligne propre id=${cleanLines[0].id})`,
      });
    }
  }
}

console.log(
  `\n[duplicates] ${toSoftRemove.length} ligne(s) candidate(s) au soft-remove ` +
    `(polluée avec doublon propre existant).`,
);
for (const r of toSoftRemove.slice(0, 50)) {
  console.log(`  → id=${r.id}  "${r.serial_number}"  (${r.reason})`);
}
if (toSoftRemove.length > 50) console.log(`  … (+${toSoftRemove.length - 50} autres)`);

if (!applyDuplicates) {
  console.log(
    '\n[duplicates] dry-run termin\u00e9 (pas de modif). Rejouer avec --apply-duplicates.',
  );
  process.exit(0);
}

const softRemove = db.prepare(
  `UPDATE equipment
      SET status = 'removed', updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND (status IS NULL OR status != 'removed')`,
);
const txDup = db.transaction((list) => {
  let changed = 0;
  for (const r of list) {
    const info = softRemove.run(r.id);
    changed += info.changes;
  }
  return changed;
});
const nDup = txDup(toSoftRemove);
console.log(`[duplicates] ${nDup} ligne(s) soft-removed.`);
