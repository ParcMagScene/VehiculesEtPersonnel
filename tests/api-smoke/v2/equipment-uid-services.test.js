#!/usr/bin/env node
/**
 * Tests unitaires — services/equipment-uid/* (T-P1-06).
 */

import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';

import Database from 'better-sqlite3';

import {
  auditUidState,
  EquipmentUidV2NotFoundError,
  EquipmentUidV2ValidationError,
  regenerateEquipmentUid,
} from '../../../apps/api/services/equipment-uid/index.js';

let db;

function setupSchema(database) {
  database.exec(`
    CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT);
    CREATE TABLE equipment (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      serial_number TEXT,
      uid TEXT,
      notes TEXT,
      updated_at DATETIME
    );
    CREATE TABLE equipment_serials (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      equipment_id INTEGER,
      serial TEXT,
      uid TEXT,
      status TEXT DEFAULT 'active'
    );
    CREATE TABLE uid_counter (
      id INTEGER PRIMARY KEY CHECK(id=1),
      value INTEGER NOT NULL
    );
    INSERT INTO uid_counter (id, value) VALUES (1, 0);
  `);
}

before(() => {
  db = new Database(':memory:');
  setupSchema(db);
});

after(() => db.close());

beforeEach(() => {
  db.exec(
    'DELETE FROM equipment; DELETE FROM equipment_serials; UPDATE uid_counter SET value = 0;',
  );
});

describe('equipment-uid/regenerate', () => {
  it('valide equipmentId (entier > 0)', () => {
    assert.throws(
      () => regenerateEquipmentUid({ db, equipmentId: 0 }),
      EquipmentUidV2ValidationError,
    );
    assert.throws(
      () => regenerateEquipmentUid({ db, equipmentId: 'foo' }),
      EquipmentUidV2ValidationError,
    );
  });

  it('throw NotFound si equipment absent', () => {
    assert.throws(
      () => regenerateEquipmentUid({ db, equipmentId: 999 }),
      EquipmentUidV2NotFoundError,
    );
  });

  it('regenere un UID et audit dans notes', () => {
    const info = db
      .prepare(
        "INSERT INTO equipment (name, uid, notes) VALUES ('Console', 'EMAG-00001', 'old note')",
      )
      .run();
    const r = regenerateEquipmentUid({
      db,
      equipmentId: info.lastInsertRowid,
      regeneratedBy: 42,
      reason: 'QR code perdu',
    });
    assert.equal(r.previous_uid, 'EMAG-00001');
    assert.match(r.new_uid, /^EMAG-\d{5}$/);
    assert.notEqual(r.new_uid, 'EMAG-00001');
    assert.equal(r.regenerated_by, 42);

    const updated = db
      .prepare('SELECT uid, notes FROM equipment WHERE id = ?')
      .get(info.lastInsertRowid);
    assert.equal(updated.uid, r.new_uid);
    assert.match(updated.notes, /old note/);
    assert.match(updated.notes, /\[UID-REGEN /);
    assert.match(updated.notes, /QR code perdu/);
    assert.match(updated.notes, /by user #42/);
  });

  it('regenere sans reason ni user (audit minimal)', () => {
    const info = db
      .prepare("INSERT INTO equipment (name, uid) VALUES ('Micro', 'EMAG-00002')")
      .run();
    const r = regenerateEquipmentUid({ db, equipmentId: info.lastInsertRowid });
    assert.equal(r.previous_uid, 'EMAG-00002');
    assert.match(r.new_uid, /^EMAG-\d{5}$/);
    assert.equal(r.regenerated_by, null);

    const updated = db
      .prepare('SELECT notes FROM equipment WHERE id = ?')
      .get(info.lastInsertRowid);
    assert.match(updated.notes, /\[UID-REGEN /);
    assert.doesNotMatch(updated.notes, /by user #/);
  });

  it('gere le cas equipment.uid = null (previous_uid = null, log "vide")', () => {
    const info = db.prepare("INSERT INTO equipment (name, uid) VALUES ('SansUid', NULL)").run();
    const r = regenerateEquipmentUid({ db, equipmentId: info.lastInsertRowid });
    assert.equal(r.previous_uid, null);
    const updated = db
      .prepare('SELECT notes FROM equipment WHERE id = ?')
      .get(info.lastInsertRowid);
    assert.match(updated.notes, /\(vide\)/);
  });
});

describe('equipment-uid/audit', () => {
  it('base vide -> tous les compteurs a 0, verdict OK', () => {
    const r = auditUidState(db);
    assert.equal(r.equipment_total, 0);
    assert.equal(r.equipment_with_uid, 0);
    assert.equal(r.equipment_without_uid, 0);
    assert.equal(r.duplicate_serials.length, 0);
    assert.equal(r.duplicate_uids.length, 0);
    assert.match(r.verdict, /OK/);
  });

  it('detecte les doublons serial_number', () => {
    db.prepare("INSERT INTO equipment (name, serial_number) VALUES ('A', 'SN-001')").run();
    db.prepare("INSERT INTO equipment (name, serial_number) VALUES ('B', 'SN-001')").run();
    db.prepare("INSERT INTO equipment (name, serial_number) VALUES ('C', 'SN-002')").run();
    const r = auditUidState(db);
    assert.equal(r.duplicate_serials.length, 1);
    assert.equal(r.duplicate_serials[0].serial_number, 'SN-001');
    assert.equal(r.duplicate_serials[0].count, 2);
    assert.equal(r.duplicate_serials[0].ids.length, 2);
    assert.match(r.verdict, /doublons serial_number/);
  });

  it('detecte les doublons uid', () => {
    db.prepare("INSERT INTO equipment (name, uid) VALUES ('X', 'EMAG-99999')").run();
    db.prepare("INSERT INTO equipment (name, uid) VALUES ('Y', 'EMAG-99999')").run();
    const r = auditUidState(db);
    assert.equal(r.duplicate_uids.length, 1);
    assert.equal(r.duplicate_uids[0].uid, 'EMAG-99999');
    assert.match(r.verdict, /doublons uid/);
  });

  it('compte les equipments sans uid', () => {
    db.prepare("INSERT INTO equipment (name, uid) VALUES ('avec', 'EMAG-00001')").run();
    db.prepare("INSERT INTO equipment (name, uid) VALUES ('sans1', NULL)").run();
    db.prepare("INSERT INTO equipment (name, uid) VALUES ('sans2', '')").run();
    const r = auditUidState(db);
    assert.equal(r.equipment_total, 3);
    assert.equal(r.equipment_with_uid, 1);
    assert.equal(r.equipment_without_uid, 2);
    assert.match(r.verdict, /sans uid/);
  });
});
