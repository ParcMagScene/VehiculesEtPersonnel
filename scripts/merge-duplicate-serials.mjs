#!/usr/bin/env node
/**
 * merge-duplicate-serials.mjs
 *
 * Détecte et fusionne les équipements dont le serial_number a été importé
 * sous la forme  "<SN_BASE>   - <NUMERO_MAG>"  (ex: "2300858495 - P1").
 *
 * Pour chaque groupe :
 *  - "ancien" = ligne avec SN suffixé "<SN> - <Lxx>"
 *  - "nouveau" = ligne avec SN propre "<SN>" + numero_mag = "<Lxx>"
 *
 * Actions :
 *  1. Paire nette (1 ancien + 1 nouveau matchent par sn_base + suffix) :
 *     - Reporte les sav_tickets, equipment_assignments, equipment_lists
 *       de l'ancien vers le nouveau (si non vides)
 *     - Supprime l'ancien
 *  2. Ancien orphelin (aucun nouveau matchant) :
 *     - UPDATE serial_number = sn_base, numero_mag = suffix
 *  3. Cas atypiques (collision : 2 anciens, 2 nouveaux, suffixes ambigus) :
 *     - Skip + log
 *
 * Usage :
 *   node scripts/merge-duplicate-serials.mjs           # dry-run (par défaut)
 *   node scripts/merge-duplicate-serials.mjs --apply   # exécution réelle
 *   node scripts/merge-duplicate-serials.mjs --db <path>
 */

import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const dbArgIdx = args.indexOf('--db');
const DB_PATH = dbArgIdx >= 0 ? args[dbArgIdx + 1] : path.resolve('apps/api/vehicules.db');

if (!fs.existsSync(DB_PATH)) {
  console.error(`✗ DB introuvable: ${DB_PATH}`);
  process.exit(1);
}

// Backup automatique en mode --apply
if (APPLY) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backup = `${DB_PATH}.backup-merge-dups-${stamp}`;
  fs.copyFileSync(DB_PATH, backup);
  console.log(`✓ Backup DB → ${backup}`);
}

const db = new Database(DB_PATH);
db.pragma('foreign_keys = ON');

// Pattern : capture <base> et <suffix> où suffix = MAG = LETTRES + CHIFFRES
// (ex: T01, VX1, E09, AB12). Source: apps/api/services/magNumber.js
// Exemples : "2300858495    - P1", "AH100662 - V12", "SN-X - VX1"
// Séparateur strict : " - " avec espaces (ou em-dash " — " toléré pour legacy).
const MAG_PART_RE = '[A-Za-z]{1,3}[0-9]{1,4}';
const SUFFIX_RE = new RegExp(`^(.*?)\\s+[-—]\\s+(${MAG_PART_RE})\\s*$`);
const MAG_VALIDATE_RE = new RegExp(`^${MAG_PART_RE}$`);

const all = db
  .prepare(
    `
  SELECT id, uid, name, serial_number, numero_mag
  FROM equipment
  WHERE serial_number IS NOT NULL AND TRIM(serial_number) <> ''
`,
  )
  .all();

// Index : par (sn_base, suffix) → lignes "anciennes"
// Index : par (sn_base, numero_mag) → lignes "nouvelles"
const oldRows = []; // {row, sn_base, suffix}
const newByKey = new Map(); // key = `${sn_base}|${mag}` → [rows]

for (const row of all) {
  const sn = row.serial_number.replace(/\s+/g, ' ').trim();
  const m = sn.match(SUFFIX_RE);
  if (m) {
    const sn_base = m[1].trim();
    const suffix = m[2].toUpperCase();
    oldRows.push({ row, sn_base, suffix });
  } else if (row.numero_mag && MAG_VALIDATE_RE.test(row.numero_mag.trim())) {
    const key = `${sn.trim()}|${row.numero_mag.trim().toUpperCase()}`;
    if (!newByKey.has(key)) newByKey.set(key, []);
    newByKey.get(key).push(row);
  }
}

console.log(`\n[scan] equipment avec SN: ${all.length}`);
console.log(`[scan] candidats "ancien" (SN suffixé) : ${oldRows.length}`);
console.log(`[scan] index "nouveau" (SN propre + N°MAG) : ${newByKey.size} clés\n`);

// Comptage refs
const countSav = db.prepare('SELECT COUNT(*) c FROM sav_tickets WHERE equipment_id = ?');
const countAssign = db.prepare(
  'SELECT COUNT(*) c FROM equipment_assignments WHERE equipment_id = ?',
);
const countLists = db.prepare('SELECT COUNT(*) c FROM equipment_lists WHERE equipment_id = ?');

const updateSav = db.prepare('UPDATE sav_tickets SET equipment_id = ? WHERE equipment_id = ?');
const updateAssign = db.prepare(
  'UPDATE equipment_assignments SET equipment_id = ? WHERE equipment_id = ?',
);
const updateLists = db.prepare(
  'UPDATE equipment_lists SET equipment_id = ? WHERE equipment_id = ?',
);

const deleteEq = db.prepare('DELETE FROM equipment WHERE id = ?');
const updateEq = db.prepare(
  'UPDATE equipment SET serial_number = ?, numero_mag = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
);

let stats = {
  paired: 0,
  orphan: 0,
  skipped: 0,
  savMoved: 0,
  assignMoved: 0,
  listMoved: 0,
  deleted: 0,
  normalized: 0,
};

const tx = db.transaction(() => {
  for (const { row, sn_base, suffix } of oldRows) {
    const key = `${sn_base}|${suffix}`;
    const matches = newByKey.get(key);

    if (!matches || matches.length === 0) {
      // Orphelin → normaliser en place
      stats.orphan++;
      stats.normalized++;
      console.log(
        `[orphan] ${row.uid}  "${row.serial_number}"  →  SN="${sn_base}", N°MAG="${suffix}"`,
      );
      if (APPLY) updateEq.run(sn_base, suffix, row.id);
      continue;
    }

    if (matches.length > 1) {
      stats.skipped++;
      console.log(
        `[skip]   ${row.uid}  collision: ${matches.length} candidats nouveaux pour ${key}`,
      );
      continue;
    }

    const target = matches[0];
    if (target.id === row.id) {
      stats.skipped++;
      continue;
    }

    const nbSav = countSav.get(row.id).c;
    const nbAssign = countAssign.get(row.id).c;
    const nbList = countLists.get(row.id).c;

    stats.paired++;
    stats.savMoved += nbSav;
    stats.assignMoved += nbAssign;
    stats.listMoved += nbList;
    stats.deleted++;

    console.log(
      `[merge]  ${row.uid} → ${target.uid}  (sn_base=${sn_base}, mag=${suffix})  ` +
        `[sav=${nbSav}, assign=${nbAssign}, lists=${nbList}]`,
    );

    if (APPLY) {
      if (nbSav) updateSav.run(target.id, row.id);
      if (nbAssign) updateAssign.run(target.id, row.id);
      if (nbList) updateLists.run(target.id, row.id);
      deleteEq.run(row.id);
    }
  }
});

tx.immediate ? tx.immediate() : tx();

console.log(`\n=== RÉSUMÉ ${APPLY ? '(APPLIQUÉ)' : '(DRY-RUN)'} ===`);
console.log(`Paires fusionnées  : ${stats.paired}  (équipements supprimés: ${stats.deleted})`);
console.log(`Orphelins normalisés: ${stats.orphan}`);
console.log(`Skippés (collision): ${stats.skipped}`);
console.log(`SAV transférés     : ${stats.savMoved}`);
console.log(`Assignments transf.: ${stats.assignMoved}`);
console.log(`Listes transférées : ${stats.listMoved}`);
if (!APPLY)
  console.log(`\n→ Pour exécuter réellement : node scripts/merge-duplicate-serials.mjs --apply`);

db.close();
