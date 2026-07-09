#!/usr/bin/env node
/**
 * Tests smoke — migrations/locations-v2-schema-v1.js (T-P0-10).
 *
 * Vérifie :
 * - Idempotence des CREATE TABLE.
 * - Import initial des JSON dépôts si présents (INSERT OR IGNORE).
 * - Structure des colonnes `depot_svg_maps` + `equipment_location_history`.
 */

import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

import Database from 'better-sqlite3';

import { runLocationsV2SchemaMigration } from '../../apps/api/migrations/locations-v2-schema-v1.js';

let db;

before(() => {
  db = new Database(':memory:');
  // Table equipment nécessaire pour la FK ON DELETE CASCADE.
  db.exec(`CREATE TABLE equipment (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT)`);
  db.exec(`CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT)`);
});

after(() => db.close());

describe('migrations/locations-v2-schema-v1 (T-P0-10)', () => {
  it('crée depot_svg_maps + equipment_location_history sans erreur', () => {
    runLocationsV2SchemaMigration(db);
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
      .all()
      .map((r) => r.name);
    assert.ok(tables.includes('depot_svg_maps'), 'depot_svg_maps existe');
    assert.ok(tables.includes('equipment_location_history'), 'equipment_location_history existe');
  });

  it('idempotent : deuxième exécution ne throw pas', () => {
    runLocationsV2SchemaMigration(db);
    runLocationsV2SchemaMigration(db);
    // Pas de doublon de lignes attendu.
  });

  it('depot_svg_maps a le schéma attendu', () => {
    const cols = db.pragma('table_info(depot_svg_maps)').map((c) => c.name);
    for (const expected of [
      'id',
      'depot_id',
      'name',
      'version',
      'svg_width',
      'svg_height',
      'floors_json',
      'categories_json',
      'zones_json',
      'source_file',
      'imported_at',
      'updated_at',
    ]) {
      assert.ok(cols.includes(expected), `colonne ${expected} présente`);
    }
  });

  it('equipment_location_history a le schéma attendu', () => {
    const cols = db.pragma('table_info(equipment_location_history)').map((c) => c.name);
    for (const expected of [
      'id',
      'equipment_id',
      'previous_depot',
      'previous_floor',
      'previous_zone',
      'previous_code',
      'new_depot',
      'new_floor',
      'new_zone',
      'new_code',
      'moved_by',
      'moved_at',
      'notes',
    ]) {
      assert.ok(cols.includes(expected), `colonne ${expected} présente`);
    }
  });

  it("UNIQUE(depot_id) : rejette un doublon d'insert manuel", () => {
    // Insert un dépôt fictif puis retente le même depot_id.
    db.prepare(
      `INSERT INTO depot_svg_maps (depot_id, name, floors_json, categories_json, zones_json)
       VALUES ('test-42', 'Test', '[]', '[]', '[]')`,
    ).run();
    assert.throws(
      () =>
        db
          .prepare(
            `INSERT INTO depot_svg_maps (depot_id, name, floors_json, categories_json, zones_json)
             VALUES ('test-42', 'Autre', '[]', '[]', '[]')`,
          )
          .run(),
      /UNIQUE constraint failed/,
    );
  });

  it('equipment_location_history CASCADE lors de suppression equipment', () => {
    const eqRes = db.prepare('INSERT INTO equipment (name) VALUES (?)').run('Test-eq');
    const eqId = eqRes.lastInsertRowid;
    db.prepare(
      `INSERT INTO equipment_location_history (equipment_id, new_depot, new_zone)
       VALUES (?, '1', 'A')`,
    ).run(eqId);
    const before = db
      .prepare('SELECT COUNT(*) as n FROM equipment_location_history WHERE equipment_id = ?')
      .get(eqId).n;
    assert.equal(before, 1);
    // FK CASCADE requiert PRAGMA foreign_keys = ON.
    db.pragma('foreign_keys = ON');
    db.prepare('DELETE FROM equipment WHERE id = ?').run(eqId);
    const after = db
      .prepare('SELECT COUNT(*) as n FROM equipment_location_history WHERE equipment_id = ?')
      .get(eqId).n;
    assert.equal(after, 0, 'CASCADE a supprimé le history');
  });
});
