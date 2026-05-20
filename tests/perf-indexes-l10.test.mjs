// tests/perf-indexes-l10.test.mjs — L10 (8.1) — Perf DB
//
// Vérifie que applyPerfL10Indexes :
//  - crée les index composites attendus quand les tables existent
//  - est idempotent (deux passes successives ne lèvent pas)
//  - tolère l'absence d'une table (succeeded < attempted, pas de throw)
//  - lève si db invalide
import test from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';

import { PERF_L10_INDEXES, applyPerfL10Indexes } from '../apps/api/services/perfIndexesL10.js';

function setupSchema(db) {
  db.exec(`
    CREATE TABLE affaire_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      affaire_id INTEGER NOT NULL,
      event_type TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      designation TEXT NOT NULL
    );
    CREATE TABLE task_assignments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      person_id INTEGER,
      date TEXT
    );
    CREATE TABLE sav_tickets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      equipment_id INTEGER,
      status TEXT
    );
    CREATE TABLE bp_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bl_import_id INTEGER,
      item_type TEXT
    );
    CREATE TABLE supplier_articles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      supplier_id INTEGER,
      designation TEXT
    );
    CREATE TABLE tracking_sheets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT,
      status TEXT
    );
  `);
}

function listIndexes(db) {
  return db
    .prepare("SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_%'")
    .all()
    .map((r) => r.name);
}

test('PERF_L10_INDEXES: liste non vide de strings CREATE INDEX', () => {
  assert.ok(Array.isArray(PERF_L10_INDEXES));
  assert.ok(PERF_L10_INDEXES.length >= 5);
  for (const sql of PERF_L10_INDEXES) {
    assert.match(sql, /^CREATE INDEX IF NOT EXISTS idx_/);
  }
});

test('applyPerfL10Indexes: crée tous les index quand tables présentes', () => {
  const db = new Database(':memory:');
  setupSchema(db);
  const result = applyPerfL10Indexes(db);
  assert.equal(result.attempted, PERF_L10_INDEXES.length);
  assert.equal(result.succeeded, PERF_L10_INDEXES.length);
  assert.equal(result.failed, 0);
  const idx = listIndexes(db);
  assert.ok(idx.includes('idx_ah_affaire_created'));
  assert.ok(idx.includes('idx_order_items_order_designation'));
  assert.ok(idx.includes('idx_ta_person_date'));
  assert.ok(idx.includes('idx_sav_equipment_status'));
  assert.ok(idx.includes('idx_bp_items_bl_type'));
  assert.ok(idx.includes('idx_supplier_articles_supplier_designation'));
  assert.ok(idx.includes('idx_tracking_sheets_date_status'));
  db.close();
});

test('applyPerfL10Indexes: idempotent (2 passes)', () => {
  const db = new Database(':memory:');
  setupSchema(db);
  const r1 = applyPerfL10Indexes(db);
  const r2 = applyPerfL10Indexes(db);
  assert.equal(r1.succeeded, PERF_L10_INDEXES.length);
  assert.equal(r2.succeeded, PERF_L10_INDEXES.length);
  assert.equal(r2.failed, 0);
  db.close();
});

test('applyPerfL10Indexes: tolère table absente sans throw', () => {
  const db = new Database(':memory:');
  // On ne crée qu'une seule table : les autres index seront ignorés silencieusement.
  db.exec(`CREATE TABLE order_items (id INTEGER PRIMARY KEY, order_id INTEGER, designation TEXT)`);
  const result = applyPerfL10Indexes(db);
  assert.equal(result.attempted, PERF_L10_INDEXES.length);
  assert.equal(result.succeeded, 1);
  assert.equal(result.failed, PERF_L10_INDEXES.length - 1);
  assert.ok(result.errors.length === result.failed);
  db.close();
});

test('applyPerfL10Indexes: db null → throw TypeError', () => {
  assert.throws(() => applyPerfL10Indexes(null), TypeError);
  assert.throws(() => applyPerfL10Indexes({}), TypeError);
});

test('applyPerfL10Indexes: index composite affaire_history correct (EXPLAIN)', () => {
  const db = new Database(':memory:');
  setupSchema(db);
  applyPerfL10Indexes(db);
  // EXPLAIN QUERY PLAN doit utiliser l'index composite pour la requête réelle
  // de l'endpoint /import-history.
  const plan = db
    .prepare(
      `EXPLAIN QUERY PLAN
       SELECT * FROM affaire_history WHERE affaire_id = ?
       ORDER BY created_at DESC, id DESC LIMIT 10`,
    )
    .all(1);
  const detail = plan.map((r) => r.detail).join(' | ');
  assert.match(detail, /idx_ah_affaire_created/);
  db.close();
});
