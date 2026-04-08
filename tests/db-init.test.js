#!/usr/bin/env node
/**
 * Test d'initialisation de la base de données
 *
 * Vérifie que database.js s'initialise correctement et que
 * les tables critiques existent avec les colonnes attendues.
 *
 * Usage : node --test tests/db-init.test.js
 */

import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import db from '../apps/api/database.js';

after(() => db.close());

const CRITICAL_TABLES = [
  'users',
  'vehicles',
  'reservations',
  'persons',
  'affaires',
  'equipment',
  'equipment_categories',
  'bl_imports',
  'bp_items',
  'sav_tickets',
  'modification_history',
];

describe('Database initialization', () => {
  it('db connection is active', () => {
    const row = db.prepare('SELECT 1 AS ok').get();
    assert.equal(row.ok, 1);
  });

  it('WAL mode is enabled', () => {
    const mode = db.pragma('journal_mode', { simple: true });
    assert.equal(mode, 'wal');
  });

  it('foreign_keys are ON', () => {
    const fk = db.pragma('foreign_keys', { simple: true });
    assert.equal(fk, 1);
  });

  it('busy_timeout is set', () => {
    const timeout = db.pragma('busy_timeout', { simple: true });
    assert.ok(timeout >= 5000, `busy_timeout=${timeout}, attendu >= 5000`);
  });

  for (const table of CRITICAL_TABLES) {
    it(`table "${table}" exists`, () => {
      const cols = db.pragma(`table_info(${table})`);
      assert.ok(cols.length > 0, `Table ${table} n'existe pas ou est vide`);
    });
  }

  it('users table has required columns', () => {
    const cols = db.pragma('table_info(users)').map(c => c.name);
    for (const col of ['id', 'email', 'password_hash', 'is_admin']) {
      assert.ok(cols.includes(col), `Colonne manquante: users.${col}`);
    }
  });

  it('affaires table has required columns', () => {
    const cols = db.pragma('table_info(affaires)').map(c => c.name);
    for (const col of ['id', 'numero_affaire', 'type', 'client']) {
      assert.ok(cols.includes(col), `Colonne manquante: affaires.${col}`);
    }
  });

  it('equipment table has required columns', () => {
    const cols = db.pragma('table_info(equipment)').map(c => c.name);
    for (const col of ['id', 'reference', 'category_id']) {
      assert.ok(cols.includes(col), `Colonne manquante: equipment.${col}`);
    }
  });
});
