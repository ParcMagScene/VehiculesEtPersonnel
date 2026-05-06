#!/usr/bin/env node
/**
 * Tests d'intégration — Chaîne Locmat (modèle A) sur SQLite in-memory.
 * Vérifie que le cycle preview → confirm (simulé) → re-preview est idempotent.
 *
 * Usage : node --test tests/locmat-import-integration.test.js
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';

import { diffWithDatabase } from '../apps/api/services/locmatImport.js';

// Réplique minimale de la table equipment (champs utilisés par les builders).
function createDb() {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE equipment (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uid TEXT UNIQUE,
      name TEXT NOT NULL,
      reference TEXT,
      description TEXT,
      barcode TEXT,
      location TEXT,
      stock_quantity INTEGER DEFAULT 0,
      purchase_price REAL DEFAULT 0,
      sell_price REAL DEFAULT 0,
      is_serialized INTEGER DEFAULT 0,
      serial_number TEXT,
      status TEXT DEFAULT 'active',
      created_by INTEGER
    );
    CREATE UNIQUE INDEX ix_equipment_ref_serial
      ON equipment(reference, serial_number)
      WHERE status = 'active';
  `);
  return db;
}

// Réplique des builders de locmatImportRoutes.js (modèle A).
function buildDbCatalogByCode(db) {
  const rows = db.prepare(`
    SELECT id, name, reference, description, purchase_price AS unit_price,
           sell_price, stock_quantity AS quantity, barcode, location,
           is_serialized, serial_number
    FROM equipment
    WHERE reference IS NOT NULL AND reference != ''
      AND status = 'active'
      AND name NOT LIKE '%[archive]%'
  `).all();
  const map = new Map();
  for (const r of rows) {
    const key = String(r.reference).toUpperCase();
    const existing = map.get(key);
    if (!existing) { map.set(key, r); continue; }
    if ((!r.serial_number || r.serial_number === '') && existing.serial_number) {
      map.set(key, r);
    }
  }
  return map;
}
function buildDbSerialsByCode(db) {
  const rows = db.prepare(`
    SELECT reference, serial_number
    FROM equipment
    WHERE reference IS NOT NULL AND reference != ''
      AND serial_number IS NOT NULL AND serial_number != ''
      AND status = 'active'
  `).all();
  const map = new Map();
  for (const r of rows) {
    const key = String(r.reference).toUpperCase();
    if (!map.has(key)) map.set(key, new Set());
    map.get(key).add(r.serial_number);
  }
  return map;
}
function buildDbOwnerCodeBySerial(db) {
  const rows = db.prepare(`
    SELECT reference, serial_number FROM equipment
    WHERE serial_number IS NOT NULL AND serial_number != ''
      AND status = 'active'
  `).all();
  const map = new Map();
  for (const r of rows) map.set(r.serial_number, String(r.reference).toUpperCase());
  return map;
}

function previewDiff(db, locations, serials) {
  return diffWithDatabase({
    locations,
    serials,
    dbCatalogByCode: buildDbCatalogByCode(db),
    dbSerialsByCode: buildDbSerialsByCode(db),
    dbOwnerCodeBySerial: buildDbOwnerCodeBySerial(db),
  });
}

// Réplique simplifiée de la transaction confirm() (modèle A).
function applyConfirm(db, diff) {
  const insertCatalog = db.prepare(`
    INSERT INTO equipment (name, reference, stock_quantity, status, is_serialized, serial_number, uid)
    VALUES (?, ?, ?, 'active', 0, NULL, ?)
  `);
  const insertUnit = db.prepare(`
    INSERT INTO equipment (name, reference, stock_quantity, status, is_serialized, serial_number, uid)
    VALUES (?, ?, 1, 'active', 0, ?, ?)
  `);
  const updateProduct = db.prepare(`
    UPDATE equipment SET name = COALESCE(?, name) WHERE id = ?
  `);
  const updateQty = db.prepare(`UPDATE equipment SET stock_quantity = ? WHERE id = ?`);
  const softRemoveUnit = db.prepare(`
    UPDATE equipment SET status = 'removed'
    WHERE UPPER(reference) = UPPER(?) AND serial_number = ? AND status = 'active'
  `);

  let uidSeq = 90000;
  const newCatalog = new Map();

  // Phase A : nouveaux produits (catalogue uniquement si non sérialisés)
  for (const p of diff.newProducts) {
    if (p.isSerialized) {
      newCatalog.set(String(p.code).toUpperCase(), p);
    } else {
      insertCatalog.run(p.name, p.code, p.quantity ?? 0, `EMAG-${++uidSeq}`);
    }
  }
  // Phase B : updates produits
  for (const u of diff.updatedProducts) updateProduct.run(u.diffs?.name?.to ?? null, u.id);
  // Phase C : ajustements quantité
  for (const q of diff.quantityChanges) updateQty.run(q.to, q.id);
  // Phase D : nouveaux serials → 1 ligne equipment / unité
  for (const s of diff.newSerials) {
    const cat = newCatalog.get(String(s.code).toUpperCase());
    const name = cat ? cat.name : s.code;
    insertUnit.run(name, s.code, s.serial, `EMAG-${++uidSeq}`);
  }
  // Phase E : serials retirés → soft delete
  for (const r of diff.removedSerials) softRemoveUnit.run(r.code, r.serial);
}

describe('Locmat e2e (modèle A) — preview → confirm → idempotence', () => {
  it('cycle complet : insert nouveaux + delta + idempotence', () => {
    const db = createDb();

    // Seed : 1 produit non sérialisé existant + 1 famille sérialisée (catalogue + 2 unités)
    db.prepare(`INSERT INTO equipment (name, reference, stock_quantity, uid) VALUES (?, ?, ?, ?)`)
      .run('Vis M8', 'VIS-1', 50, 'EMAG-00001');
    db.prepare(`INSERT INTO equipment (name, reference, stock_quantity, uid) VALUES (?, ?, ?, ?)`)
      .run('Caméra X', 'CAM-X', 0, 'EMAG-00002');
    db.prepare(`INSERT INTO equipment (name, reference, stock_quantity, serial_number, uid) VALUES (?, ?, 1, ?, ?)`)
      .run('Caméra X', 'CAM-X', 'SN-A', 'EMAG-00003');
    db.prepare(`INSERT INTO equipment (name, reference, stock_quantity, serial_number, uid) VALUES (?, ?, 1, ?, ?)`)
      .run('Caméra X', 'CAM-X', 'SN-B', 'EMAG-00004');

    // CSV : VIS-1 maj quantité, NEW-1 nouveau produit, CAM-X retire SN-B + ajoute SN-C, CAM-Y nouvelle famille sérialisée
    const locations = [
      { code: 'VIS-1', name: 'Vis M8', quantity: 60, price: 0, isSerialized: false },
      { code: 'NEW-1', name: 'Boulon', quantity: 10, price: 0, isSerialized: false },
      { code: 'CAM-X', name: 'Caméra X', quantity: 2, price: 0, isSerialized: true },
      { code: 'CAM-Y', name: 'Caméra Y', quantity: 1, price: 0, isSerialized: true },
    ];
    const serials = [
      { code: 'CAM-X', serial: 'SN-A' },
      { code: 'CAM-X', serial: 'SN-C' },
      { code: 'CAM-Y', serial: 'SN-Y1' },
    ];

    // 1er preview
    const diff1 = previewDiff(db, locations, serials);
    assert.equal(diff1.errors.length, 0, 'aucune erreur attendue');
    assert.equal(diff1.collisions.length, 0, 'aucune collision attendue');
    assert.equal(diff1.newProducts.length, 2, 'NEW-1 + CAM-Y nouveaux');
    assert.equal(diff1.newSerials.length, 2, 'SN-C + SN-Y1 nouveaux');
    assert.deepEqual(
      diff1.removedSerials.map((s) => s.serial).sort(),
      ['SN-B'],
    );
    // VIS-1 doit avoir un quantityChange 50 → 60
    const visQty = diff1.quantityChanges.find((q) => q.code === 'VIS-1');
    assert.ok(visQty, 'quantityChange VIS-1 attendu');
    assert.equal(visQty.from, 50);
    assert.equal(visQty.to, 60);

    // Confirm (simulé)
    applyConfirm(db, diff1);

    // Vérifications état DB
    const visRow = db.prepare(`SELECT stock_quantity FROM equipment WHERE reference='VIS-1' AND serial_number IS NULL`).get();
    assert.equal(visRow.stock_quantity, 60);
    const camXSerials = db.prepare(`SELECT serial_number FROM equipment WHERE reference='CAM-X' AND serial_number IS NOT NULL AND status='active' ORDER BY serial_number`).all();
    assert.deepEqual(camXSerials.map((r) => r.serial_number), ['SN-A', 'SN-C']);
    // Modèle A : nouvelle famille sérialisée → uniquement l'unité (pas de ligne catalogue)
    const camY = db.prepare(`SELECT COUNT(*) AS n FROM equipment WHERE reference='CAM-Y' AND status='active'`).get();
    assert.equal(camY.n, 1, 'CAM-Y : 1 unité sérialisée seulement');
    const camYUnit = db.prepare(`SELECT serial_number FROM equipment WHERE reference='CAM-Y' AND status='active'`).get();
    assert.equal(camYUnit.serial_number, 'SN-Y1');
    const new1 = db.prepare(`SELECT stock_quantity FROM equipment WHERE reference='NEW-1'`).get();
    assert.equal(new1.stock_quantity, 10);

    // Idempotence : re-preview avec mêmes CSV → tout vide
    const diff2 = previewDiff(db, locations, serials);
    assert.equal(diff2.errors.length, 0);
    assert.equal(diff2.collisions.length, 0);
    assert.equal(diff2.newProducts.length, 0, 'idempotence : aucun nouveau produit');
    assert.equal(diff2.newSerials.length, 0, 'idempotence : aucun nouveau serial');
    assert.equal(diff2.removedSerials.length, 0, 'idempotence : aucun serial retiré');
    assert.equal(diff2.quantityChanges.length, 0, 'idempotence : aucun delta quantité');
  });

  it('refuse une collision DB cross-référence (modèle A)', () => {
    const db = createDb();
    // SN-X appartient à OWNER-1
    db.prepare(`INSERT INTO equipment (name, reference, stock_quantity, serial_number, uid) VALUES (?, ?, 1, ?, ?)`)
      .run('Owner', 'OWNER-1', 'SN-X', 'EMAG-00010');

    const diff = previewDiff(
      db,
      [{ code: 'INTRUDER', name: 'I', quantity: 1, isSerialized: true }],
      [{ code: 'INTRUDER', serial: 'SN-X' }],
    );
    const c = diff.collisions.find((x) => x.scope === 'db-cross-ref');
    assert.ok(c, 'collision db-cross-ref attendue');
    assert.equal(c.dbCode, 'OWNER-1');
    assert.equal(c.csvCode, 'INTRUDER');
    assert.equal(diff.newSerials.length, 0, 'serial bloqué');
  });
});
