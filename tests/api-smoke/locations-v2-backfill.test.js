#!/usr/bin/env node
/**
 * Tests smoke — scripts/locations-v2-backfill.mjs (T-P0-11).
 *
 * Le script est un binaire node autonome qui importe `apps/api/
 * database.js` et donc ouvre la DB reelle configuree via env.
 * Ce test l'invoque via child_process.spawn avec `DB_PATH=<memory-file>`
 * pointant sur un fichier SQLite fraichement construit contenant un
 * mini schema equipment + depot_svg_maps.
 *
 * On verifie :
 *   - Le script sort en code 0 quand aucun ecart n'est detecte.
 *   - Le script sort en code 1 quand des ecarts sont detectes.
 *   - Le rapport JSON contient les champs attendus.
 */

import { spawnSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import path from 'node:path';

import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

import Database from 'better-sqlite3';

const REPO_ROOT = path.resolve(new URL('../..', import.meta.url).pathname);
const SCRIPT = path.join(REPO_ROOT, 'scripts', 'locations-v2-backfill.mjs');
// database.js resout DB_PATH relativement a apps/api/. On stocke les
// fichiers de test dans ce dossier avec un prefixe explicite pour un
// cleanup fiable en fin de suite.
const API_DIR = path.join(REPO_ROOT, 'apps', 'api');
const TEST_DB_PREFIX = '_test-locations-backfill-';

/** @type {string[]} */
const testDbFiles = [];

function seedMinimalDb(db) {
  // Schema minimal cible du script.
  db.exec(`
    CREATE TABLE equipment (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      location TEXT,
      location_depot TEXT,
      location_floor TEXT,
      location_zone TEXT,
      location_code TEXT
    );
    CREATE TABLE depot_svg_maps (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      depot_id TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      version TEXT,
      svg_width INTEGER,
      svg_height INTEGER,
      floors_json TEXT NOT NULL DEFAULT '[]',
      categories_json TEXT NOT NULL DEFAULT '[]',
      zones_json TEXT NOT NULL DEFAULT '[]',
      source_file TEXT,
      imported_at TEXT,
      updated_at TEXT
    );
    CREATE TABLE equipment_location_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      equipment_id INTEGER NOT NULL,
      previous_depot TEXT,
      previous_floor TEXT,
      previous_zone TEXT,
      previous_code TEXT,
      new_depot TEXT,
      new_floor TEXT,
      new_zone TEXT,
      new_code TEXT,
      moved_by INTEGER,
      moved_at TEXT,
      notes TEXT
    );
  `);
  // Un depot avec 2 zones connues (H1, H2).
  db.prepare(
    `INSERT INTO depot_svg_maps (depot_id, name, floors_json, categories_json, zones_json)
     VALUES ('1', 'Depot Test', '[]', '[]', '[{"id":"H1"},{"id":"H2"}]')`,
  ).run();
}

before(() => {
  // Rien a preparer : les fichiers de test sont crees a la demande
  // dans chaque `it()` avec un nom prefixe pour cleanup fiable.
});

after(() => {
  for (const rel of testDbFiles) {
    for (const suffix of ['', '-wal', '-shm']) {
      try {
        rmSync(path.join(API_DIR, rel + suffix), { force: true });
      } catch {
        /* ignore */
      }
    }
  }
});

/** Cree un fichier DB dans apps/api/ + retourne son nom relatif. */
function makeTestDbPath(label) {
  const rel = `${TEST_DB_PREFIX}${label}.db`;
  testDbFiles.push(rel);
  return { rel, abs: path.join(API_DIR, rel) };
}

/**
 * Extrait le premier bloc JSON de la sortie stdout du script. Le
 * logger de `apps/api/database.js` pollue stdout avec ses lignes
 * `[INFO]` avant le JSON — on cherche donc la premiere ligne `{`.
 */
function extractJsonReport(stdout) {
  const idx = stdout.indexOf('\n{');
  if (idx === -1) throw new Error('Pas de bloc JSON detecte dans stdout');
  return JSON.parse(stdout.slice(idx));
}

describe('locations-v2-backfill.mjs (T-P0-11)', () => {
  it('sort code 0 + verdict OK quand aucun ecart', () => {
    const { rel, abs } = makeTestDbPath('ok');
    const db = new Database(abs);
    seedMinimalDb(db);
    // Un equipement avec une zone connue et un depot renseigne : ok.
    db.prepare(
      `INSERT INTO equipment (name, location_depot, location_zone, location_code)
       VALUES ('EQ-OK', '1', 'H1', 'A01')`,
    ).run();
    db.close();

    const result = spawnSync('node', [SCRIPT], {
      env: { ...process.env, DB_PATH: rel, NODE_ENV: 'test' },
      encoding: 'utf8',
      timeout: 15_000,
    });

    assert.equal(result.status, 0, `stderr=${result.stderr}\nstdout tail=${result.stdout.slice(-400)}`);
    const report = extractJsonReport(result.stdout);
    assert.equal(report.ticket, 'T-P0-11');
    assert.equal(report.verdict, 'OK (aucun ecart detecte)');
    assert.equal(report.totals.total, 1);
    assert.equal(report.unknown_zones.count, 0);
    assert.equal(report.duplicate_codes.count, 0);
    assert.equal(report.partial_locations.count, 0);
  });

  it('sort code 1 quand ecarts detectes (zone inconnue + partial + doublons)', () => {
    const { rel, abs } = makeTestDbPath('ecarts');
    const db = new Database(abs);
    seedMinimalDb(db);
    // 1. Zone inconnue dans le SVG.
    db.prepare(
      `INSERT INTO equipment (name, location_depot, location_zone)
       VALUES ('EQ-1', '1', 'ZONE_INEXISTANTE')`,
    ).run();
    // 2. Location partielle (zone sans depot).
    db.prepare(
      `INSERT INTO equipment (name, location_zone) VALUES ('EQ-2', 'H1')`,
    ).run();
    // 3. Doublon de code dans la meme cellule.
    db.prepare(
      `INSERT INTO equipment (name, location_depot, location_floor, location_zone, location_code)
       VALUES ('EQ-3a', '1', 'RDC', 'H1', 'A01')`,
    ).run();
    db.prepare(
      `INSERT INTO equipment (name, location_depot, location_floor, location_zone, location_code)
       VALUES ('EQ-3b', '1', 'RDC', 'H1', 'A01')`,
    ).run();
    db.close();

    const result = spawnSync('node', [SCRIPT], {
      env: { ...process.env, DB_PATH: rel, NODE_ENV: 'test' },
      encoding: 'utf8',
      timeout: 15_000,
    });

    assert.equal(result.status, 1, `stderr=${result.stderr}\nstdout tail=${result.stdout.slice(-400)}`);
    const report = extractJsonReport(result.stdout);
    assert.equal(report.verdict, 'ECARTS_DETECTES (voir details)');
    assert.equal(report.totals.total, 4);
    assert.ok(report.unknown_zones.count >= 1, 'zone inconnue detectee');
    assert.ok(report.partial_locations.count >= 1, 'partial detecte');
    assert.ok(report.duplicate_codes.count >= 1, 'doublon detecte');
  });

  it('--apply produit un warning mais reste en dry-run', () => {
    const { rel, abs } = makeTestDbPath('apply');
    const db = new Database(abs);
    seedMinimalDb(db);
    db.prepare(`INSERT INTO equipment (name) VALUES ('EQ-empty')`).run();
    db.close();

    const result = spawnSync('node', [SCRIPT, '--apply'], {
      env: { ...process.env, DB_PATH: rel, NODE_ENV: 'test' },
      encoding: 'utf8',
      timeout: 15_000,
    });

    assert.equal(result.status, 0);
    assert.match(result.stderr, /--apply n'est PAS implemente/);
    const report = extractJsonReport(result.stdout);
    assert.equal(report.apply_requested, true);
    assert.equal(report.apply_applied, false);
  });
});
