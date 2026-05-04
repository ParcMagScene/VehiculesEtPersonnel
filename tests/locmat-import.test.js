#!/usr/bin/env node
/**
 * Tests unitaires — Service Locmat (logique pure de diff)
 * Usage : node --test tests/locmat-import.test.js
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  diffWithDatabase,
  normalizeLocationRow,
  normalizeSerialRow,
} from '../apps/api/services/locmatImport.js';

describe('normalizeLocationRow', () => {
  it('tolère les en-têtes accentués / casse', () => {
    const r = normalizeLocationRow({
      'Code Libre': 'ABC-1',
      'Désignation': 'Vis M8',
      'Quantité': '12',
      'Tarif': '0,45',
      'Sérialisé': 'oui',
    });
    assert.equal(r.code, 'ABC-1');
    assert.equal(r.name, 'Vis M8');
    assert.equal(r.quantity, 12);
    assert.equal(r.price, 0.45);
    assert.equal(r.isSerialized, true);
  });

  it('renvoie null pour ligne vide', () => {
    assert.equal(normalizeLocationRow({}), null);
  });
});

describe('normalizeSerialRow', () => {
  it('exige un numéro de série', () => {
    assert.equal(normalizeSerialRow({ Code: 'X' }), null);
    const r = normalizeSerialRow({ Code: 'X', 'Numéro de Série': 'SN001' });
    assert.deepEqual(r, { code: 'X', serial: 'SN001', name: null });
  });
});

describe('diffWithDatabase', () => {
  it('détecte newProducts / updatedProducts / quantityChanges', () => {
    const dbItemsByCode = new Map([
      ['ABC-1', { id: 1, name: 'Vis M8', description: null, unit_price: 0.45, sell_price: 0, quantity: 10, barcode: null, location: null }],
    ]);
    const locations = [
      { code: 'ABC-1', name: 'Vis M8 hex', quantity: 12, price: 0.5, value: 0, description: null, category: null, barcode: null, location: null, isMagScene: false, isSerialized: false },
      { code: 'NEW-1', name: 'Boulon', quantity: 5, price: 0, value: 0, description: null, category: null, barcode: null, location: null, isMagScene: false, isSerialized: false },
    ];

    const r = diffWithDatabase({
      locations,
      serials: [],
      dbItemsByCode,
      dbSerialsByItemId: new Map(),
    });

    assert.equal(r.newProducts.length, 1);
    assert.equal(r.newProducts[0].code, 'NEW-1');
    assert.equal(r.updatedProducts.length, 1);
    assert.ok(r.updatedProducts[0].diffs.name);
    assert.ok(r.updatedProducts[0].diffs.unit_price);
    assert.equal(r.quantityChanges.length, 1);
    assert.equal(r.quantityChanges[0].from, 10);
    assert.equal(r.quantityChanges[0].to, 12);
  });

  it('détecte newSerials / removedSerials', () => {
    const dbItemsByCode = new Map([['REF-1', { id: 7, name: 'Caméra', quantity: 3 }]]);
    const dbSerialsByItemId = new Map([[7, new Set(['SN-A', 'SN-B'])]]);
    const serials = [
      { code: 'REF-1', serial: 'SN-A' },
      { code: 'REF-1', serial: 'SN-C' }, // nouveau
    ];

    const r = diffWithDatabase({ locations: [], serials, dbItemsByCode, dbSerialsByItemId });
    assert.deepEqual(
      r.newSerials.map((s) => s.serial),
      ['SN-C'],
    );
    assert.deepEqual(
      r.removedSerials.map((s) => s.serial),
      ['SN-B'],
    );
  });

  it('crée un produit implicite si Serialise.csv référence une ref absente', () => {
    const r = diffWithDatabase({
      locations: [],
      serials: [
        { code: 'ORPHAN', serial: 'SN-1', name: 'Item orphelin' },
        { code: 'ORPHAN', serial: 'SN-2' },
      ],
      dbItemsByCode: new Map(),
      dbSerialsByItemId: new Map(),
    });
    assert.equal(r.newProducts.length, 1);
    assert.equal(r.newProducts[0].code, 'ORPHAN');
    assert.equal(r.newProducts[0].fromSerialiseOnly, true);
    assert.equal(r.newSerials.length, 2);
  });

  it('signale les codes dupliqués comme erreurs', () => {
    const r = diffWithDatabase({
      locations: [
        { code: 'X', name: 'A', quantity: 1, price: 0, value: 0, description: null, category: null, barcode: null, location: null, isMagScene: false, isSerialized: false },
        { code: 'X', name: 'B', quantity: 2, price: 0, value: 0, description: null, category: null, barcode: null, location: null, isMagScene: false, isSerialized: false },
      ],
      serials: [],
      dbItemsByCode: new Map(),
      dbSerialsByItemId: new Map(),
    });
    assert.ok(r.errors.some((e) => /dupliqué/i.test(e.message)));
  });

  it('active is_serialized + aligne la quantité quand un équipement non sérialisé reçoit des serials externes (Locmat)', () => {
    // équipement existant marqué non sérialisé dans eMag, quantité 1
    const dbItemsByCode = new Map([
      ['CAM-1', { id: 42, name: 'Caméra X', quantity: 1, is_serialized: 0 }],
    ]);
    const r = diffWithDatabase({
      locations: [
        { code: 'CAM-1', name: 'Caméra X', quantity: 1, price: 0, value: 0,
          description: null, category: null, barcode: null, location: null,
          isMagScene: false, isSerialized: false },
      ],
      serials: [
        { code: 'CAM-1', serial: 'SN-1' },
        { code: 'CAM-1', serial: 'SN-2' },
        { code: 'CAM-1', serial: 'SN-3' },
      ],
      dbItemsByCode,
      dbSerialsByItemId: new Map(),
    });

    assert.equal(r.serializationChanges.length, 1);
    assert.equal(r.serializationChanges[0].id, 42);
    assert.equal(r.serializationChanges[0].to, true);
    assert.equal(r.serializationChanges[0].serialCount, 3);

    // Quantité forcée à 3 (= nb serials actifs après import), pas à la valeur Locations.csv
    assert.equal(r.quantityChanges.length, 1);
    assert.equal(r.quantityChanges[0].id, 42);
    assert.equal(r.quantityChanges[0].to, 3);
    assert.equal(r.quantityChanges[0].reason, 'serialization-sync');
    assert.equal(r.newSerials.length, 3);
  });

  it("ne génère pas de serializationChange si l'équipement est déjà sérialisé", () => {
    const dbItemsByCode = new Map([
      ['CAM-2', { id: 5, name: 'Caméra Y', quantity: 2, is_serialized: 1 }],
    ]);
    const r = diffWithDatabase({
      locations: [],
      serials: [{ code: 'CAM-2', serial: 'SN-9' }],
      dbItemsByCode,
      dbSerialsByItemId: new Map([[5, new Set(['SN-9'])]]),
    });
    assert.equal(r.serializationChanges.length, 0);
  });

  it('détecte les doublons stricts dans Serialise.csv', () => {
    const r = diffWithDatabase({
      locations: [
        { code: 'CAM-1', name: 'Cam', quantity: 2, price: 0, isSerialized: true },
      ],
      serials: [
        { code: 'CAM-1', serial: 'SN1' },
        { code: 'CAM-1', serial: 'SN1' }, // doublon
      ],
      dbItemsByCode: new Map(),
      dbSerialsByItemId: new Map(),
    });
    assert.equal(r.duplicates.serials.length, 1);
    assert.equal(r.duplicates.serials[0].serial, 'SN1');
  });

  it('détecte les collisions intra-CSV (même serial sur 2 codes)', () => {
    const r = diffWithDatabase({
      locations: [
        { code: 'CAM-1', name: 'A', quantity: 1, isSerialized: true },
        { code: 'CAM-2', name: 'B', quantity: 1, isSerialized: true },
      ],
      serials: [
        { code: 'CAM-1', serial: 'SN-X' },
        { code: 'CAM-2', serial: 'SN-X' }, // collision
      ],
      dbItemsByCode: new Map(),
      dbSerialsByItemId: new Map(),
    });
    const c = r.collisions.find((x) => x.scope === 'csv-cross-code');
    assert.ok(c, 'collision csv-cross-code attendue');
    assert.deepEqual(c.codes.sort(), ['CAM-1', 'CAM-2']);
  });

  it('détecte les collisions DB cross-équipement', () => {
    const r = diffWithDatabase({
      locations: [{ code: 'CAM-1', name: 'A', quantity: 1, isSerialized: true }],
      serials: [{ code: 'CAM-1', serial: 'SN-EXIST' }],
      dbItemsByCode: new Map([
        ['CAM-1', { id: 7, name: 'A', quantity: 1, is_serialized: 1 }],
      ]),
      dbSerialsByItemId: new Map(),
      // SN-EXIST appartient déjà à un AUTRE équipement (#42)
      dbSerialOwnerBySerial: new Map([['SN-EXIST', 42]]),
    });
    const c = r.collisions.find((x) => x.scope === 'db-cross-equipment');
    assert.ok(c, 'collision db-cross-equipment attendue');
    assert.equal(c.dbEquipmentId, 42);
    assert.equal(c.csvEquipmentId, 7);
    assert.equal(r.newSerials.length, 0);
  });

  it('liste les suppressions (refs en DB absentes des CSV)', () => {
    const dbItemsByCode = new Map([
      ['OLD-1', { id: 11, name: 'Vieux', reference: 'OLD-1', quantity: 3, is_serialized: 0 }],
      ['KEEP-1', { id: 12, name: 'Gardé', reference: 'KEEP-1', quantity: 1, is_serialized: 0 }],
    ]);
    const r = diffWithDatabase({
      locations: [
        { code: 'KEEP-1', name: 'Gardé', quantity: 1, isSerialized: false },
      ],
      serials: [],
      dbItemsByCode,
      dbSerialsByItemId: new Map(),
    });
    assert.equal(r.missingProducts.length, 1);
    assert.equal(r.missingProducts[0].code, 'OLD-1');
    assert.equal(r.missingProducts[0].quantity, 3);
  });
});
