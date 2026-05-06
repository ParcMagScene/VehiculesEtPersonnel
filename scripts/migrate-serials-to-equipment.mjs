#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════
//  migrate-serials-to-equipment.mjs
//  Migration Modèle B (1 catalogue + N serials)  →  Modèle A (1 ligne par unité)
//
//  Usage :
//    node scripts/migrate-serials-to-equipment.mjs --db <path>                    # DRY-RUN
//    node scripts/migrate-serials-to-equipment.mjs --db <path> --apply            # APPLIQUE
//    node scripts/migrate-serials-to-equipment.mjs --db <path> --apply --merge-by-ref
//        ↳ pour les serials déjà présents en equipment avec MÊME reference,
//          on fusionne (lien serial→equipment existant) au lieu de bloquer.
//
//  Classification des serials :
//    C (clean)    → pas de doublon       → INSERT nouvelle ligne equipment
//    A (merge)    → SN+ref déjà en eq.   → fusion vers eq existant (si --merge-by-ref)
//    B (cross)    → SN sur ref différente → BLOQUE (à arbitrer manuellement)
//
//  Sortie :
//    /tmp/serials-migration-report.csv
//    /tmp/serials-migration-conflicts-B.csv
// ════════════════════════════════════════════════════════════════════

import Database from 'better-sqlite3';
import { writeFileSync } from 'node:fs';
import { argv, exit } from 'node:process';

const args = argv.slice(2);
const apply = args.includes('--apply');
const mergeByRef = args.includes('--merge-by-ref');
const dbIdx = args.indexOf('--db');
const dbPath = dbIdx >= 0 ? args[dbIdx + 1] : 'apps/api/vehicules.db';

console.log(`📂 DB : ${dbPath}`);
console.log(`⚙️  Mode : ${apply ? '🔥 APPLY' : '👁️  DRY-RUN'}${mergeByRef ? ' + merge-by-ref' : ''}`);

const db = new Database(dbPath);
db.pragma('foreign_keys = ON');

const serials = db
  .prepare(
    `SELECT s.id            AS serial_id,
            s.equipment_id  AS catalog_id,
            s.serial,
            s.uid           AS serial_uid,
            s.mag_number,
            e.name          AS catalog_name,
            e.reference     AS catalog_ref,
            e.category_id, e.brand, e.brand_id, e.model,
            e.location, e.location_zone, e.location_code, e.location_floor, e.location_depot,
            e.purchase_price, e.notes AS catalog_notes, e.photo
     FROM equipment_serials s
     JOIN equipment e ON e.id = s.equipment_id
     WHERE s.status = 'active'
     ORDER BY s.equipment_id, s.id`,
  )
  .all();

console.log(`📊 ${serials.length} serials actifs`);

// Normalisation reference : trim espaces + suppression trailing '-'
// (les catalogues hérités ont souvent un suffixe '-', ex: 'A15-FOCUS-' vs 'A15-FOCUS')
const normRef = (s) => (s || '').trim().replace(/-+$/, '').toUpperCase();

const eqByUid = new Map(
  db.prepare("SELECT id, uid FROM equipment WHERE uid IS NOT NULL AND uid != ''").all().map((r) => [r.uid, r.id]),
);
const eqBySerial = new Map();
for (const r of db
  .prepare(
    "SELECT id, uid, serial_number, reference FROM equipment WHERE serial_number IS NOT NULL AND serial_number != ''",
  )
  .all()) {
  if (!eqBySerial.has(r.serial_number)) eqBySerial.set(r.serial_number, []);
  eqBySerial.get(r.serial_number).push(r);
}

const planC = []; // INSERT
const planA = []; // MERGE
const planB = []; // BLOCK

for (const s of serials) {
  const conflictUid = s.serial_uid && eqByUid.has(s.serial_uid);
  const matches = s.serial ? eqBySerial.get(s.serial) || [] : [];

  if (conflictUid) {
    const eqId = eqByUid.get(s.serial_uid);
    const target = matches.find((m) => m.id === eqId);
    if (target && normRef(target.reference) === normRef(s.catalog_ref)) {
      planA.push({ ...s, target_eq_id: eqId, reason: 'uid+ref match' });
    } else {
      planB.push({ ...s, conflict: 'uid_conflict', detail: `uid ${s.serial_uid} déjà sur eq#${eqId}` });
    }
    continue;
  }
  const sameRef = matches.find((m) => normRef(m.reference) === normRef(s.catalog_ref));
  const otherRef = matches.filter((m) => normRef(m.reference) !== normRef(s.catalog_ref));
  if (sameRef) {
    planA.push({ ...s, target_eq_id: sameRef.id, target_uid: sameRef.uid, reason: 'serial+ref match' });
    continue;
  }
  if (otherRef.length > 0) {
    planB.push({
      ...s,
      conflict: 'cross_ref',
      detail: otherRef.map((m) => `eq#${m.id}(${m.uid},${m.reference})`).join('|'),
    });
    continue;
  }
  planC.push(s);
}

const catalogIds = [...new Set(serials.map((s) => s.catalog_id))];
const savCount = catalogIds.length
  ? db
      .prepare(`SELECT COUNT(*) AS n FROM sav_tickets WHERE equipment_id IN (${catalogIds.map(() => '?').join(',')})`)
      .get(...catalogIds).n
  : 0;

console.log('');
console.log('═══════════════ RAPPORT ═══════════════');
console.log(`  Serials totaux ............ ${serials.length}`);
console.log(`  C — INSERT clean .......... ${planC.length}`);
console.log(`  A — Merge même ref ........ ${planA.length}  ${mergeByRef ? '(fusion)' : '(BLOQUE sans --merge-by-ref)'}`);
console.log(`  B — Cross-ref / conflit ... ${planB.length}  (BLOQUE — arbitrage manuel)`);
console.log(`  SAV tickets sur catalogues  ${savCount}`);
console.log('════════════════════════════════════════');

const header = ['classe', 'serial_id', 'catalog_id', 'catalog_ref', 'serial', 'serial_uid', 'mag', 'action', 'detail'];
const rows = [
  ...planC.map((p) => ['C', p.serial_id, p.catalog_id, p.catalog_ref, p.serial, p.serial_uid, p.mag_number, 'INSERT', '']),
  ...planA.map((p) => ['A', p.serial_id, p.catalog_id, p.catalog_ref, p.serial, p.serial_uid, p.mag_number, `MERGE→eq#${p.target_eq_id}`, p.reason]),
  ...planB.map((p) => ['B', p.serial_id, p.catalog_id, p.catalog_ref, p.serial, p.serial_uid, p.mag_number, 'BLOCK', `${p.conflict} ${p.detail}`]),
];
writeFileSync(
  '/tmp/serials-migration-report.csv',
  [header.join(';'), ...rows.map((r) => r.map((v) => String(v ?? '').replaceAll(';', ',')).join(';'))].join('\n'),
  'utf8',
);
console.log('📄 /tmp/serials-migration-report.csv');

if (planB.length > 0) {
  writeFileSync(
    '/tmp/serials-migration-conflicts-B.csv',
    [header.join(';'), ...planB.map((p) => ['B', p.serial_id, p.catalog_id, p.catalog_ref, p.serial, p.serial_uid, p.mag_number, 'BLOCK', `${p.conflict} ${p.detail}`].map((v) => String(v ?? '').replaceAll(';', ',')).join(';'))].join('\n'),
    'utf8',
  );
  console.log('📄 /tmp/serials-migration-conflicts-B.csv');
}

if (!apply) {
  console.log('\n💡 DRY-RUN terminé.');
  exit(0);
}

if (planB.length > 0) {
  console.error(`\n❌ ${planB.length} conflits type B — résolvez avant --apply.`);
  exit(1);
}
if (planA.length > 0 && !mergeByRef) {
  console.error(`\n❌ ${planA.length} serials type A — utilisez --merge-by-ref pour fusionner.`);
  exit(1);
}

console.log('\n🔥 APPLY : transaction...');

function getNextUidLocal() {
  const r1 = db.prepare("SELECT MAX(CAST(SUBSTR(uid,6) AS INTEGER)) AS m FROM equipment WHERE uid LIKE 'EMAG-%'").get();
  const r2 = db.prepare("SELECT MAX(CAST(SUBSTR(uid,6) AS INTEGER)) AS m FROM equipment_serials WHERE uid LIKE 'EMAG-%'").get();
  let n = Math.max(r1?.m || 0, r2?.m || 0) + 1;
  const fE = db.prepare('SELECT 1 FROM equipment WHERE uid = ? LIMIT 1');
  const fS = db.prepare('SELECT 1 FROM equipment_serials WHERE uid = ? LIMIT 1');
  while (true) {
    const c = `EMAG-${String(n).padStart(5, '0')}`;
    if (!fE.get(c) && !fS.get(c)) return c;
    n++;
  }
}

const insertEq = db.prepare(`
  INSERT INTO equipment
    (name, reference, serial_number, category_id, brand, brand_id, model,
     stock_quantity, status, location, location_zone, location_code, location_floor, location_depot,
     purchase_price, notes, photo, uid, numero_mag, is_serialized, created_by)
  VALUES (?, ?, ?, ?, ?, ?, ?, 1, 'available', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NULL)
`);
const markMigrated = db.prepare(
  "UPDATE equipment_serials SET status='migrated', removed_at=CURRENT_TIMESTAMP, notes=COALESCE(notes,'') || ? WHERE id=?",
);
const archiveCatalog = db.prepare(`
  UPDATE equipment SET is_serialized=0, stock_quantity=0,
    name = CASE WHEN name LIKE '%[archive]%' THEN name ELSE name || ' [archive]' END,
    updated_at = CURRENT_TIMESTAMP
  WHERE id = ?
`);
const setUidIfMissing = db.prepare("UPDATE equipment SET uid = ? WHERE id = ? AND (uid IS NULL OR uid = '')");

let inserted = 0, merged = 0;

const tx = db.transaction(() => {
  for (const p of planC) {
    const uid = p.serial_uid || getNextUidLocal();
    const res = insertEq.run(
      p.catalog_name, p.catalog_ref, p.serial, p.category_id, p.brand, p.brand_id, p.model,
      p.location, p.location_zone, p.location_code, p.location_floor, p.location_depot,
      p.purchase_price, p.catalog_notes, p.photo, uid, p.mag_number,
    );
    markMigrated.run(` [migrated→equipment#${res.lastInsertRowid}]`, p.serial_id);
    inserted++;
  }
  for (const p of planA) {
    if (p.serial_uid) setUidIfMissing.run(p.serial_uid, p.target_eq_id);
    markMigrated.run(` [merged→equipment#${p.target_eq_id} (${p.reason})]`, p.serial_id);
    merged++;
  }
  for (const cid of catalogIds) archiveCatalog.run(cid);
});

tx();

console.log(`✅ ${inserted} INSERT (clean)`);
console.log(`✅ ${merged} MERGE (fusion vers eq existant)`);
console.log(`✅ ${catalogIds.length} catalogues archivés`);
