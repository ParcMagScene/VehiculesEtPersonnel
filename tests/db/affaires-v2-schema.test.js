#!/usr/bin/env node
/**
 * Tests smoke — migrations/affaires-v2-schema-v1.js (T-P0-08).
 *
 * Verifie :
 * - Materialisation INSERT OR IGNORE (aucune ecrasement).
 * - Ajout idempotent des colonnes affaire_ref_id + index associes.
 * - Backfill affaire_ref_id depuis les colonnes TEXT existantes.
 * - Idempotence globale (2e execution = no-op).
 * - Table affaire_history creee avec le schema attendu.
 */

import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';

import Database from 'better-sqlite3';

import { runAffairesV2SchemaMigration } from '../../apps/api/migrations/affaires-v2-schema-v1.js';

let db;

/**
 * Prepare une base minimale mimant les tables reellement presentes
 * en production (subset des colonnes strictement necessaires a la
 * migration).
 */
function setupSchema(database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT
    );
    CREATE TABLE IF NOT EXISTS affaires (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      numero_affaire TEXT NOT NULL UNIQUE,
      nom TEXT DEFAULT '',
      type TEXT NOT NULL DEFAULT 'Prestation',
      client TEXT,
      date_debut TEXT,
      date_fin TEXT,
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS reservations (
      id TEXT PRIMARY KEY,
      vehicle_id TEXT,
      start_date TEXT,
      end_date TEXT,
      client_name TEXT,
      prestation_name TEXT,
      affaire TEXT
    );
    CREATE TABLE IF NOT EXISTS missions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      affaire TEXT
    );
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      reference TEXT NOT NULL,
      affaire_id TEXT
    );
    CREATE TABLE IF NOT EXISTS bl_imports (
      id TEXT PRIMARY KEY,
      affaire_id TEXT,
      filename TEXT
    );
    CREATE TABLE IF NOT EXISTS dynamic_display_events (
      id TEXT PRIMARY KEY,
      affaire_id TEXT,
      type TEXT,
      category TEXT,
      date TEXT
    );
    CREATE TABLE IF NOT EXISTS equipment_assignments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      equipment_id INTEGER NOT NULL,
      start_date TEXT NOT NULL,
      affaire_id TEXT
    );
  `);
}

function seedImplicits(database) {
  // Une affaire deja materialisee (AF-KNOWN) et une nouvelle implicite (AF-NEW)
  database
    .prepare(
      "INSERT INTO affaires (numero_affaire, client, date_debut, date_fin) VALUES ('AF-KNOWN', 'Client A', '2026-01-01', '2026-01-10')",
    )
    .run();

  // Reservation qui pointe vers l'affaire connue (backfill trivial).
  database
    .prepare(
      "INSERT INTO reservations (id, vehicle_id, start_date, end_date, client_name, prestation_name, affaire) VALUES ('r1', 'v1', '2026-01-05', '2026-01-08', 'Client A', 'Presta A', 'AF-KNOWN')",
    )
    .run();

  // Reservation implicite (aucune ligne affaires pour AF-NEW).
  database
    .prepare(
      "INSERT INTO reservations (id, vehicle_id, start_date, end_date, client_name, prestation_name, affaire) VALUES ('r2', 'v2', '2026-02-10', '2026-02-15', 'Client B', 'Presta B', 'AF-NEW')",
    )
    .run();
  database
    .prepare(
      "INSERT INTO reservations (id, vehicle_id, start_date, end_date, client_name, prestation_name, affaire) VALUES ('r3', 'v2', '2026-02-16', '2026-02-20', 'Client B', 'Presta B suite', 'AF-NEW')",
    )
    .run();

  // Autre source implicite : orders.
  database
    .prepare("INSERT INTO orders (reference, affaire_id) VALUES ('CMD-1', 'AF-ORDERS-ONLY')")
    .run();

  // Reservation avec affaire vide ou NULL — doit etre ignoree.
  database
    .prepare(
      "INSERT INTO reservations (id, vehicle_id, start_date, end_date, affaire) VALUES ('r-empty', 'v3', '2026-03-01', '2026-03-02', '')",
    )
    .run();
  database
    .prepare(
      "INSERT INTO reservations (id, vehicle_id, start_date, end_date, affaire) VALUES ('r-null', 'v3', '2026-03-03', '2026-03-04', NULL)",
    )
    .run();
}

before(() => {
  db = new Database(':memory:');
});

after(() => db.close());

beforeEach(() => {
  // Reset entre les tests
  db.exec(`
    DROP TABLE IF EXISTS reservations;
    DROP TABLE IF EXISTS missions;
    DROP TABLE IF EXISTS orders;
    DROP TABLE IF EXISTS bl_imports;
    DROP TABLE IF EXISTS dynamic_display_events;
    DROP TABLE IF EXISTS equipment_assignments;
    DROP TABLE IF EXISTS affaire_history;
    DROP TABLE IF EXISTS affaires;
    DROP TABLE IF EXISTS users;
  `);
  setupSchema(db);
});

describe('migrations/affaires-v2-schema-v1 (T-P0-08)', () => {
  it("n'echoue pas si aucune affaire implicite (base vide)", () => {
    runAffairesV2SchemaMigration(db);
    const count = db.prepare('SELECT COUNT(*) AS n FROM affaires').get().n;
    assert.equal(count, 0);
    // Colonnes affaire_ref_id ajoutees quand meme.
    for (const t of [
      'reservations',
      'missions',
      'orders',
      'bl_imports',
      'dynamic_display_events',
      'equipment_assignments',
    ]) {
      const cols = db.pragma(`table_info(${t})`).map((c) => c.name);
      assert.ok(cols.includes('affaire_ref_id'), `${t}.affaire_ref_id existe`);
    }
    // Table history creee.
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table'")
      .all()
      .map((r) => r.name);
    assert.ok(tables.includes('affaire_history'));
  });

  it('materialise les affaires implicites via INSERT OR IGNORE', () => {
    seedImplicits(db);
    runAffairesV2SchemaMigration(db);
    const rows = db
      .prepare(
        'SELECT numero_affaire, client, date_debut, date_fin FROM affaires ORDER BY numero_affaire',
      )
      .all();
    assert.equal(rows.length, 3);
    assert.deepEqual(
      rows.map((r) => r.numero_affaire),
      ['AF-KNOWN', 'AF-NEW', 'AF-ORDERS-ONLY'],
    );
    const afNew = rows.find((r) => r.numero_affaire === 'AF-NEW');
    assert.equal(afNew.client, 'Client B');
    assert.equal(afNew.date_debut, '2026-02-10');
    assert.equal(afNew.date_fin, '2026-02-20');
    // L'affaire ORDERS-ONLY n'a pas de reservation → date_debut null.
    const afOrders = rows.find((r) => r.numero_affaire === 'AF-ORDERS-ONLY');
    assert.equal(afOrders.date_debut, null);
    assert.equal(afOrders.date_fin, null);
  });

  it('backfill affaire_ref_id depuis colonnes TEXT', () => {
    seedImplicits(db);
    runAffairesV2SchemaMigration(db);
    // Toutes les reservations avec affaire non vide doivent avoir un
    // affaire_ref_id renseigne (materialisation prealable).
    const rows = db
      .prepare(
        "SELECT id, affaire, affaire_ref_id FROM reservations WHERE affaire IS NOT NULL AND affaire <> ''",
      )
      .all();
    assert.equal(rows.length, 3);
    for (const r of rows) {
      assert.ok(r.affaire_ref_id, `reservation ${r.id} → affaire_ref_id renseigne`);
      const target = db
        .prepare('SELECT numero_affaire FROM affaires WHERE id = ?')
        .get(r.affaire_ref_id);
      assert.equal(target.numero_affaire, r.affaire);
    }
    // Les reservations vides/null restent NULL sur affaire_ref_id.
    const empty = db
      .prepare("SELECT id, affaire_ref_id FROM reservations WHERE affaire IS NULL OR affaire = ''")
      .all();
    assert.equal(empty.length, 2);
    for (const r of empty) assert.equal(r.affaire_ref_id, null);
  });

  it('idempotence : 2e execution ne double pas les affaires ni ne re-execute ALTER', () => {
    seedImplicits(db);
    runAffairesV2SchemaMigration(db);
    const countAfter1 = db.prepare('SELECT COUNT(*) AS n FROM affaires').get().n;
    runAffairesV2SchemaMigration(db);
    const countAfter2 = db.prepare('SELECT COUNT(*) AS n FROM affaires').get().n;
    assert.equal(countAfter1, countAfter2);
    // ALTER TABLE ADD COLUMN levee une erreur au 2e run → attrapee par
    // l'idempotence via columnExists. Pas d'exception remontee.
  });

  it('cree les index attendus sur affaire_ref_id', () => {
    runAffairesV2SchemaMigration(db);
    const indexes = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_%_affaire_ref_id'",
      )
      .all()
      .map((r) => r.name);
    for (const t of [
      'reservations',
      'missions',
      'orders',
      'bl_imports',
      'dynamic_display_events',
      'equipment_assignments',
    ]) {
      assert.ok(indexes.includes(`idx_${t}_affaire_ref_id`), `index sur ${t} present`);
    }
  });

  it('table affaire_history a le schema attendu', () => {
    runAffairesV2SchemaMigration(db);
    const cols = db.pragma('table_info(affaire_history)').map((c) => c.name);
    for (const expected of [
      'id',
      'affaire_id',
      'field_name',
      'old_value',
      'new_value',
      'changed_by',
      'changed_at',
      'notes',
    ]) {
      assert.ok(cols.includes(expected), `colonne ${expected} presente`);
    }
    const indexes = db
      .prepare("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='affaire_history'")
      .all()
      .map((r) => r.name);
    assert.ok(indexes.includes('idx_affaire_history_affaire'));
    assert.ok(indexes.includes('idx_affaire_history_changed_at'));
  });

  it("n'ecrase pas une affaire existante (INSERT OR IGNORE)", () => {
    // Cas de figure : une affaire deja materialisee avec un client
    // different de celui deduit d'une reservation implicite.
    db.prepare(
      "INSERT INTO affaires (numero_affaire, client, nom) VALUES ('AF-EXISTS', 'ClientVerite', 'NomVerite')",
    ).run();
    db.prepare(
      "INSERT INTO reservations (id, vehicle_id, start_date, end_date, client_name, prestation_name, affaire) VALUES ('r-x', 'v', '2026-01-01', '2026-01-02', 'ClientAutre', 'PrestaAutre', 'AF-EXISTS')",
    ).run();
    runAffairesV2SchemaMigration(db);
    const row = db
      .prepare("SELECT client, nom FROM affaires WHERE numero_affaire='AF-EXISTS'")
      .get();
    assert.equal(row.client, 'ClientVerite');
    assert.equal(row.nom, 'NomVerite');
    // Backfill fait quand meme.
    const ref = db
      .prepare("SELECT affaire_ref_id FROM reservations WHERE id='r-x'")
      .get().affaire_ref_id;
    assert.ok(ref);
  });
});
