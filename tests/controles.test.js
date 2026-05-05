#!/usr/bin/env node
/**
 * Tests — Module Contrôles Périodiques (logique pure + intégration DB)
 * Usage : node --test tests/controles.test.js
 */

import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';

import Database from 'better-sqlite3';

import { runControlesPeriodiquesMigrations } from '../apps/api/migrations/controles-periodiques-v1.js';
import {
  addDays,
  computeStatus,
  performControl,
  recomputeAllStatuses,
  STATUS,
  todayIso,
} from '../apps/api/services/controlesService.js';

// ─── Setup DB en mémoire ──────────────────────────────────────────
function setupDb() {
  const db = new Database(':memory:');
  // Créer tables minimales requises par la migration
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT, email TEXT, is_admin INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS vehicles (
      id TEXT PRIMARY KEY, name TEXT,
      controles_techniques TEXT
    );
    CREATE TABLE IF NOT EXISTS equipment (
      id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, uid TEXT
    );
    CREATE TABLE IF NOT EXISTS email_config (
      id INTEGER PRIMARY KEY DEFAULT 1
    );
    INSERT INTO email_config (id) VALUES (1);
  `);
  runControlesPeriodiquesMigrations(db);
  return db;
}

// ─── addDays ──────────────────────────────────────────────────────
describe('addDays', () => {
  it('ajoute des jours en respectant l\'UTC', () => {
    assert.equal(addDays('2026-01-01', 30), '2026-01-31');
    assert.equal(addDays('2026-01-31', 1), '2026-02-01');
    assert.equal(addDays('2026-02-28', 1), '2026-03-01'); // 2026 non bissextile
  });
  it('soustrait quand jours négatif', () => {
    assert.equal(addDays('2026-01-10', -10), '2025-12-31');
  });
});

// ─── computeStatus ────────────────────────────────────────────────
describe('computeStatus', () => {
  const today = new Date('2026-04-01T12:00:00Z');
  it('A_FAIRE quand échéance future', () => {
    assert.equal(
      computeStatus({ next_due_date: '2026-05-01', missed_after_days: 30 }, today),
      STATUS.A_FAIRE,
    );
  });
  it('A_FAIRE quand échéance = aujourd\'hui', () => {
    assert.equal(
      computeStatus({ next_due_date: '2026-04-01', missed_after_days: 30 }, today),
      STATUS.A_FAIRE,
    );
  });
  it('EN_RETARD quand dépassé mais < missed_after_days', () => {
    assert.equal(
      computeStatus({ next_due_date: '2026-03-15', missed_after_days: 30 }, today),
      STATUS.EN_RETARD,
    );
  });
  it('MANQUE quand dépassé > missed_after_days', () => {
    assert.equal(
      computeStatus({ next_due_date: '2026-01-01', missed_after_days: 30 }, today),
      STATUS.MANQUE,
    );
  });
});

// ─── Migration DB ─────────────────────────────────────────────────
describe('runControlesPeriodiquesMigrations', () => {
  let db;
  beforeEach(() => {
    db = setupDb();
  });
  afterEach(() => db.close());

  it('crée les tables', () => {
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table'")
      .all()
      .map((t) => t.name);
    assert.ok(tables.includes('control_types'));
    assert.ok(tables.includes('equipment_controls'));
    assert.ok(tables.includes('control_history'));
    assert.ok(tables.includes('control_notifications'));
  });

  it('seed les types standards', () => {
    const codes = db.prepare('SELECT code FROM control_types').all().map((t) => t.code);
    for (const c of ['CT', 'TACHYGRAPHE', 'LIMITEUR', 'ASSURANCE', 'LEVAGE', 'AUTRE']) {
      assert.ok(codes.includes(c), `manque ${c}`);
    }
  });

  it('idempotente — réexécution ne crée pas de doublons', () => {
    runControlesPeriodiquesMigrations(db);
    runControlesPeriodiquesMigrations(db);
    const n = db.prepare('SELECT COUNT(*) AS n FROM control_types').get().n;
    // 10 types seedés, pas plus
    assert.equal(n, 10);
  });

  it('ajoute la colonne email_config.alert_controles', () => {
    const cols = db.pragma('table_info(email_config)').map((c) => c.name);
    assert.ok(cols.includes('alert_controles'));
  });

  it('migre les controles_techniques JSON des véhicules', () => {
    const db2 = new Database(':memory:');
    db2.exec(`
      CREATE TABLE users (id INTEGER PRIMARY KEY);
      CREATE TABLE equipment (id INTEGER PRIMARY KEY);
      CREATE TABLE email_config (id INTEGER PRIMARY KEY DEFAULT 1);
      INSERT INTO email_config (id) VALUES (1);
      CREATE TABLE vehicles (id TEXT PRIMARY KEY, name TEXT, controles_techniques TEXT);
      INSERT INTO vehicles VALUES (
        'AB-123-CD', 'Camion 1',
        '[{"type":"CT","date":"2025-01-15","deadline":"2026-01-15"},{"type":"TACHYGRAPHE","date":"2024-06-01","deadline":"2026-06-01"}]'
      );
    `);
    runControlesPeriodiquesMigrations(db2);
    const ctrls = db2
      .prepare("SELECT * FROM equipment_controls WHERE entity_type='vehicle' AND entity_id='AB-123-CD'")
      .all();
    assert.equal(ctrls.length, 2);
    assert.ok(ctrls.every((c) => c.notes && c.notes.startsWith('[migrated:v1]')));
    db2.close();
  });
});

// ─── performControl ───────────────────────────────────────────────
describe('performControl', () => {
  let db;
  beforeEach(() => (db = setupDb()));
  afterEach(() => db.close());

  it('insère history + met à jour next_due_date', () => {
    const ctType = db.prepare("SELECT id FROM control_types WHERE code = 'CT'").get();
    const r = db
      .prepare(
        `INSERT INTO equipment_controls
          (entity_type, entity_id, control_type_id, periodicity_days, next_due_date, status)
         VALUES ('vehicle', 'V1', ?, 365, '2026-05-01', 'A_FAIRE')`,
      )
      .run(ctType.id);

    const updated = performControl(db, r.lastInsertRowid, {
      performed_at: '2026-04-15',
      notes: 'OK garage X',
    });

    assert.equal(updated.last_done_date, '2026-04-15');
    assert.equal(updated.next_due_date, addDays('2026-04-15', 365));
    const hist = db
      .prepare('SELECT * FROM control_history WHERE equipment_control_id = ?')
      .all(r.lastInsertRowid);
    assert.equal(hist.length, 1);
    assert.equal(hist[0].status, 'EFFECTUE');
  });

  it('respecte un next_due_date manuel', () => {
    const ctType = db.prepare("SELECT id FROM control_types WHERE code = 'CT'").get();
    const r = db
      .prepare(
        `INSERT INTO equipment_controls
          (entity_type, entity_id, control_type_id, periodicity_days, next_due_date, status)
         VALUES ('vehicle', 'V1', ?, 365, '2026-05-01', 'A_FAIRE')`,
      )
      .run(ctType.id);
    const updated = performControl(db, r.lastInsertRowid, {
      performed_at: '2026-04-15',
      next_due_date: '2027-01-01',
    });
    assert.equal(updated.next_due_date, '2027-01-01');
  });

  it('lève 404 si contrôle introuvable', () => {
    assert.throws(
      () => performControl(db, 999_999, { performed_at: '2026-04-15' }),
      /introuvable/,
    );
  });
});

// ─── recomputeAllStatuses ─────────────────────────────────────────
describe('recomputeAllStatuses', () => {
  let db;
  beforeEach(() => (db = setupDb()));
  afterEach(() => db.close());

  it('passe EN_RETARD → MANQUE et reprogramme', () => {
    const ctType = db.prepare("SELECT id FROM control_types WHERE code = 'CT'").get();
    const r = db
      .prepare(
        `INSERT INTO equipment_controls
          (entity_type, entity_id, control_type_id, periodicity_days, next_due_date, status)
         VALUES ('vehicle', 'V1', ?, 365, '2025-01-01', 'EN_RETARD')`,
      )
      .run(ctType.id);

    const today = new Date('2026-04-01T12:00:00Z');
    const result = recomputeAllStatuses(db, today);
    assert.ok(result.missed >= 1);
    const after = db.prepare('SELECT * FROM equipment_controls WHERE id = ?').get(r.lastInsertRowid);
    assert.equal(after.status, 'A_FAIRE');
    assert.notEqual(after.next_due_date, '2025-01-01');
    const hist = db
      .prepare("SELECT * FROM control_history WHERE equipment_control_id = ? AND status = 'MANQUE'")
      .all(r.lastInsertRowid);
    assert.equal(hist.length, 1);
  });

  it('passe A_FAIRE → EN_RETARD si dépassement < missed_after_days', () => {
    const ctType = db.prepare("SELECT id FROM control_types WHERE code = 'CT'").get();
    db.prepare(
      `INSERT INTO equipment_controls
        (entity_type, entity_id, control_type_id, periodicity_days, next_due_date, status)
       VALUES ('vehicle', 'V2', ?, 365, '2026-03-15', 'A_FAIRE')`,
    ).run(ctType.id);
    const result = recomputeAllStatuses(db, new Date('2026-04-01T12:00:00Z'));
    assert.ok(result.changed >= 1);
    const ctrl = db.prepare("SELECT status FROM equipment_controls WHERE entity_id = 'V2'").get();
    assert.equal(ctrl.status, 'EN_RETARD');
  });
});

// ─── todayIso (sanity) ────────────────────────────────────────────
describe('todayIso', () => {
  it('renvoie YYYY-MM-DD', () => {
    assert.match(todayIso(), /^\d{4}-\d{2}-\d{2}$/);
  });
});
