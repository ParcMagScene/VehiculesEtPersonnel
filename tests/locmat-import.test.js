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
  parseLocmatSerial,
} from '../apps/api/services/locmatImport.js';

describe('normalizeLocationRow', () => {
  it('tolère les en-têtes accentués / casse', () => {
    const r = normalizeLocationRow({
      'Code Libre': 'ABC-1',
      Désignation: 'Vis M8',
      Quantité: '12',
      Tarif: '0,45',
      Sérialisé: 'oui',
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
    assert.deepEqual(r, {
      code: 'X',
      serial: 'SN001',
      rawSerial: 'SN001',
      magNumber: null,
      name: null,
    });
  });

  it('extrait le numéro MAG en préfixe (TETRA2)', () => {
    const r = normalizeSerialRow({ Code: 'TETRA2', 'Numéro de Série': 'T01 -  2400953513' });
    assert.equal(r.serial, '2400953513');
    assert.equal(r.magNumber, 'T01');
    assert.equal(r.rawSerial, 'T01 -  2400953513');
  });

  it('extrait le numéro MAG en suffixe (VIPER)', () => {
    const r = normalizeSerialRow({ Code: 'VIPER', 'Numéro de Série': '0788770045   - V12' });
    assert.equal(r.serial, '0788770045');
    assert.equal(r.magNumber, 'V12');
  });
});

describe('parseLocmatSerial', () => {
  it('reconnait préfixe / suffixe / aucun mag', () => {
    assert.deepEqual(parseLocmatSerial('T01 -  2400953513'), {
      coreSerial: '2400953513',
      magNumber: 'T01',
    });
    assert.deepEqual(parseLocmatSerial('0788770045 - V12'), {
      coreSerial: '0788770045',
      magNumber: 'V12',
    });
    assert.deepEqual(parseLocmatSerial('B884971'), {
      coreSerial: 'B884971',
      magNumber: null,
    });
    assert.deepEqual(parseLocmatSerial(''), { coreSerial: '', magNumber: null });
  });
});

describe('diffWithDatabase', () => {
  it('détecte newProducts / updatedProducts / quantityChanges', () => {
    const dbItemsByCode = new Map([
      [
        'ABC-1',
        {
          id: 1,
          name: 'Vis M8',
          description: null,
          unit_price: 0.45,
          sell_price: 0,
          quantity: 10,
          barcode: null,
          location: null,
        },
      ],
    ]);
    const locations = [
      {
        code: 'ABC-1',
        name: 'Vis M8 hex',
        quantity: 12,
        price: 0.5,
        value: 0,
        description: null,
        category: null,
        barcode: null,
        location: null,
        isMagScene: false,
        isSerialized: false,
      },
      {
        code: 'NEW-1',
        name: 'Boulon',
        quantity: 5,
        price: 0,
        value: 0,
        description: null,
        category: null,
        barcode: null,
        location: null,
        isMagScene: false,
        isSerialized: false,
      },
    ];

    const r = diffWithDatabase({
      locations,
      serials: [],
      dbItemsByCode,
      dbSerialsByCode: new Map(),
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
    const dbSerialsByCode = new Map([['REF-1', new Set(['SN-A', 'SN-B'])]]);
    const serials = [
      { code: 'REF-1', serial: 'SN-A' },
      { code: 'REF-1', serial: 'SN-C' }, // nouveau
    ];

    const r = diffWithDatabase({ locations: [], serials, dbItemsByCode, dbSerialsByCode });
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
      dbSerialsByCode: new Map(),
    });
    assert.equal(r.newProducts.length, 1);
    assert.equal(r.newProducts[0].code, 'ORPHAN');
    assert.equal(r.newProducts[0].fromSerialiseOnly, true);
    assert.equal(r.newSerials.length, 2);
  });

  it('signale les codes dupliqués comme erreurs', () => {
    const r = diffWithDatabase({
      locations: [
        {
          code: 'X',
          name: 'A',
          quantity: 1,
          price: 0,
          value: 0,
          description: null,
          category: null,
          barcode: null,
          location: null,
          isMagScene: false,
          isSerialized: false,
        },
        {
          code: 'X',
          name: 'B',
          quantity: 2,
          price: 0,
          value: 0,
          description: null,
          category: null,
          barcode: null,
          location: null,
          isMagScene: false,
          isSerialized: false,
        },
      ],
      serials: [],
      dbItemsByCode: new Map(),
      dbSerialsByCode: new Map(),
    });
    assert.ok(r.errors.some((e) => /dupliqué/i.test(e.message)));
  });

  it('Modèle A : pas de serializationChanges dans le diff', () => {
    const r = diffWithDatabase({
      locations: [],
      serials: [{ code: 'CAM', serial: 'SN1' }],
      dbItemsByCode: new Map([['CAM', { id: 1, name: 'Cam', quantity: 1 }]]),
      dbSerialsByCode: new Map(),
    });
    assert.equal(r.serializationChanges, undefined);
  });

  it('détecte les doublons stricts dans Serialise.csv', () => {
    const r = diffWithDatabase({
      locations: [{ code: 'CAM-1', name: 'Cam', quantity: 2, price: 0, isSerialized: true }],
      serials: [
        { code: 'CAM-1', serial: 'SN1' },
        { code: 'CAM-1', serial: 'SN1' }, // doublon
      ],
      dbItemsByCode: new Map(),
      dbSerialsByCode: new Map(),
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
      dbSerialsByCode: new Map(),
    });
    const c = r.collisions.find((x) => x.scope === 'csv-cross-code');
    assert.ok(c, 'collision csv-cross-code attendue');
    assert.deepEqual(c.codes.sort(), ['CAM-1', 'CAM-2']);
  });

  it('Modèle A : détecte les collisions DB cross-référence', () => {
    const r = diffWithDatabase({
      locations: [{ code: 'CAM-1', name: 'A', quantity: 1, isSerialized: true }],
      serials: [{ code: 'CAM-1', serial: 'SN-EXIST' }],
      dbItemsByCode: new Map([['CAM-1', { id: 7, name: 'A', quantity: 1 }]]),
      dbSerialsByCode: new Map(),
      // SN-EXIST appartient déjà à une AUTRE référence
      dbOwnerCodeBySerial: new Map([['SN-EXIST', 'OTHER-REF']]),
    });
    const c = r.collisions.find((x) => x.scope === 'db-cross-ref');
    assert.ok(c, 'collision db-cross-ref attendue');
    assert.equal(c.dbCode, 'OTHER-REF');
    assert.equal(c.csvCode, 'CAM-1');
    assert.equal(r.newSerials.length, 0);
  });

  it('liste les suppressions (refs en DB absentes des CSV)', () => {
    const dbItemsByCode = new Map([
      ['OLD-1', { id: 11, name: 'Vieux', reference: 'OLD-1', quantity: 3 }],
      ['KEEP-1', { id: 12, name: 'Gardé', reference: 'KEEP-1', quantity: 1 }],
    ]);
    const r = diffWithDatabase({
      locations: [{ code: 'KEEP-1', name: 'Gardé', quantity: 1, isSerialized: false }],
      serials: [],
      dbItemsByCode,
      dbSerialsByCode: new Map(),
    });
    assert.equal(r.missingProducts.length, 1);
    assert.equal(r.missingProducts[0].code, 'OLD-1');
    assert.equal(r.missingProducts[0].quantity, 3);
  });

  it('émet serialUpdates quand le N° MAG diffère (CSV vs DB)', () => {
    const dbCatalogByCode = new Map([
      [
        'TETRA2',
        { id: 100, reference: 'TETRA2', name: 'Bar', quantity: 1, serial_number: '2400953513' },
      ],
    ]);
    const dbSerialsByCode = new Map([['TETRA2', new Set(['2400953513', '2400954278'])]]);
    const dbMagBySerial = new Map([
      ['2400953513', { magNumber: null, equipmentId: 100 }],
      ['2400954278', { magNumber: 'T99', equipmentId: 101 }],
    ]);
    const r = diffWithDatabase({
      locations: [],
      serials: [
        { code: 'TETRA2', serial: '2400953513', magNumber: 'T01' }, // était NULL → MAJ
        { code: 'TETRA2', serial: '2400954278', magNumber: 'T02' }, // était T99  → MAJ
      ],
      dbCatalogByCode,
      dbSerialsByCode,
      dbMagBySerial,
    });
    assert.equal(r.newSerials.length, 0);
    assert.equal(r.serialUpdates.length, 2);
    const u1 = r.serialUpdates.find((u) => u.serial === '2400953513');
    assert.equal(u1.magNumber, 'T01');
    assert.equal(u1.fromMag, null);
    assert.equal(u1.equipmentId, 100);
  });

  it('skip serialUpdate quand le N° MAG est déjà à jour', () => {
    const r = diffWithDatabase({
      locations: [],
      serials: [{ code: 'X', serial: 'SN1', magNumber: 'T01' }],
      dbCatalogByCode: new Map([
        ['X', { id: 1, reference: 'X', name: 'X', quantity: 1, serial_number: 'SN1' }],
      ]),
      dbSerialsByCode: new Map([['X', new Set(['SN1'])]]),
      dbMagBySerial: new Map([['SN1', { magNumber: 'T01', equipmentId: 1 }]]),
    });
    assert.equal(r.serialUpdates.length, 0);
    assert.equal(r.newSerials.length, 0);
  });

  it('signale legacyCatalogToDelete quand une ligne sans serial existe pour un code sérialisé', () => {
    const dbCatalogByCode = new Map([
      ['CAM', { id: 50, reference: 'CAM', name: 'Cam', quantity: 5, serial_number: null }],
    ]);
    const r = diffWithDatabase({
      locations: [],
      serials: [{ code: 'CAM', serial: 'SN-A' }],
      dbCatalogByCode,
      dbSerialsByCode: new Map([['CAM', new Set([])]]),
    });
    assert.equal(r.legacyCatalogToDelete.length, 1);
    assert.equal(r.legacyCatalogToDelete[0].equipmentId, 50);
    assert.equal(r.legacyCatalogToDelete[0].quantity, 5);
  });

  it('normalise un serial_number legacy au format "MAG - SN" (ex: VX14 → I14)', () => {
    // Scénario : la DB contient une unité historique dont le serial_number
    // est resté au format brut "VX14 - 2115080074074" (numero_mag NULL).
    // Le CSV LocMat apporte "I14 - 2115080074074" → coreSerial 2115080074074, mag I14.
    // Attendu : 1 serialUpdate avec equipmentId + magNumber='I14' + fromMag='VX14',
    // pas de newSerial doublon.
    const dbCatalogByCode = new Map([
      [
        'VIPER',
        {
          id: 42,
          reference: 'VIPER',
          name: 'Viper',
          quantity: 1,
          serial_number: 'VX14 - 2115080074074',
        },
      ],
    ]);
    const dbSerialsByCode = new Map([['VIPER', new Set(['2115080074074'])]]);
    const dbOwnerCodeBySerial = new Map([['2115080074074', 'VIPER']]);
    const dbMagBySerial = new Map([
      ['2115080074074', { magNumber: 'VX14', equipmentId: 42, rawSerial: 'VX14 - 2115080074074' }],
    ]);
    const r = diffWithDatabase({
      locations: [],
      serials: [
        {
          code: 'VIPER',
          serial: '2115080074074',
          magNumber: 'I14',
          rawSerial: 'I14 - 2115080074074',
        },
      ],
      dbCatalogByCode,
      dbSerialsByCode,
      dbOwnerCodeBySerial,
      dbMagBySerial,
    });
    assert.equal(r.newSerials.length, 0, 'aucun newSerial attendu (matche via coreSerial)');
    assert.equal(r.collisions.length, 0);
    assert.equal(r.serialUpdates.length, 1);
    const u = r.serialUpdates[0];
    assert.equal(u.equipmentId, 42);
    assert.equal(u.serial, '2115080074074');
    assert.equal(u.magNumber, 'I14');
    assert.equal(u.fromMag, 'VX14');
    assert.equal(u.fromSerial, 'VX14 - 2115080074074');
  });

  it('normalise un serial_number legacy même si le MAG est inchangé', () => {
    // Cas : CSV apporte le même MAG que celui déjà extrait du serial_number legacy.
    // On émet quand même un serialUpdate pour nettoyer le serial_number stocké.
    const dbMagBySerial = new Map([
      ['2400953513', { magNumber: 'T01', equipmentId: 7, rawSerial: 'T01 - 2400953513' }],
    ]);
    const r = diffWithDatabase({
      locations: [],
      serials: [{ code: 'TETRA', serial: '2400953513', magNumber: 'T01' }],
      dbCatalogByCode: new Map([
        [
          'TETRA',
          { id: 7, reference: 'TETRA', name: 'T', quantity: 1, serial_number: 'T01 - 2400953513' },
        ],
      ]),
      dbSerialsByCode: new Map([['TETRA', new Set(['2400953513'])]]),
      dbMagBySerial,
    });
    assert.equal(r.newSerials.length, 0);
    assert.equal(r.serialUpdates.length, 1);
    assert.equal(r.serialUpdates[0].equipmentId, 7);
    assert.equal(r.serialUpdates[0].fromSerial, 'T01 - 2400953513');
    assert.equal(r.serialUpdates[0].serial, '2400953513');
  });
});
