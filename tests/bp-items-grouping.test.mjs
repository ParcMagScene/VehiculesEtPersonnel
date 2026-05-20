#!/usr/bin/env node
/**
 * Tests unitaires — bpItemsGrouping (L4 méga-prompt 1.2)
 * Usage : node --test tests/bp-items-grouping.test.mjs
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  groupBpItemsByDesignation,
  groupBpItemsBySectionMap,
} from '../apps/web/src/utils/bpItemsGrouping.js';

describe('groupBpItemsByDesignation', () => {
  it('retourne [] pour un input non tableau ou vide', () => {
    assert.deepEqual(groupBpItemsByDesignation(null), []);
    assert.deepEqual(groupBpItemsByDesignation(undefined), []);
    assert.deepEqual(groupBpItemsByDesignation([]), []);
  });

  it('fusionne les lignes de même référence et somme la quantité', () => {
    const items = [
      { id: 1, reference: 'YAM-QL5', description: 'Console Yamaha QL5', quantity: 1 },
      { id: 2, reference: 'yam-ql5', description: 'Console Yamaha QL5', quantity: 1 },
      { id: 3, reference: ' YAM-QL5 ', description: 'Console Yamaha QL5', quantity: 1 },
    ];
    const out = groupBpItemsByDesignation(items);
    assert.equal(out.length, 1);
    assert.equal(out[0].quantity, 3);
    assert.equal(out[0]._groupedCount, 3);
    assert.deepEqual(out[0]._groupedIds, [1, 2, 3]);
  });

  it('fallback sur la description quand la référence est vide', () => {
    const items = [
      { id: 1, reference: '', description: 'Pied K&M 210/9', quantity: 1 },
      { id: 2, reference: null, description: 'PIED  K&M 210/9 ', quantity: 2 },
    ];
    const out = groupBpItemsByDesignation(items);
    assert.equal(out.length, 1);
    assert.equal(out[0].quantity, 3);
    assert.equal(out[0]._groupedCount, 2);
  });

  it('ne fusionne pas les lignes sans référence ni description', () => {
    const items = [
      { id: 1, reference: '', description: '', quantity: 1 },
      { id: 2, reference: '', description: '', quantity: 2 },
    ];
    const out = groupBpItemsByDesignation(items);
    assert.equal(out.length, 2);
  });

  it('promeut le matchStatus matched/manual si présent sur une ligne ultérieure', () => {
    const items = [
      {
        id: 1,
        reference: 'A',
        description: 'Article A',
        quantity: 1,
        matchStatus: 'unmatched',
      },
      {
        id: 2,
        reference: 'A',
        description: 'Article A',
        quantity: 1,
        matchStatus: 'matched',
        equipment_id: 42,
        catalogReference: 'CAT-A',
      },
    ];
    const out = groupBpItemsByDesignation(items);
    assert.equal(out.length, 1);
    assert.equal(out[0].matchStatus, 'matched');
    assert.equal(out[0].equipment_id, 42);
    assert.equal(out[0].catalogReference, 'CAT-A');
  });

  it('promeut supplierArticleId / stockItemId si présent sur une ligne ultérieure', () => {
    const items = [
      { id: 1, reference: 'B', description: 'Art B', quantity: 1 },
      {
        id: 2,
        reference: 'B',
        description: 'Art B',
        quantity: 1,
        supplierArticleId: 7,
        supplierArticleRef: 'F-7',
      },
    ];
    const out = groupBpItemsByDesignation(items);
    assert.equal(out[0].supplierArticleId, 7);
    assert.equal(out[0].supplierArticleRef, 'F-7');
  });

  it("conserve l'ordre d'apparition des groupes", () => {
    const items = [
      { id: 1, reference: 'X', description: 'X', quantity: 1 },
      { id: 2, reference: 'Y', description: 'Y', quantity: 1 },
      { id: 3, reference: 'X', description: 'X', quantity: 1 },
    ];
    const out = groupBpItemsByDesignation(items);
    assert.deepEqual(
      out.map((i) => i.reference),
      ['X', 'Y'],
    );
    assert.equal(out[0].quantity, 2);
  });

  it('gère les quantités non numériques (NaN traité comme 0)', () => {
    const items = [
      { id: 1, reference: 'A', description: 'A', quantity: 'abc' },
      { id: 2, reference: 'A', description: 'A', quantity: 3 },
    ];
    const out = groupBpItemsByDesignation(items);
    assert.equal(out[0].quantity, 3);
  });
});

describe('groupBpItemsBySectionMap', () => {
  it('retourne {} pour input invalide', () => {
    assert.deepEqual(groupBpItemsBySectionMap(null), {});
    assert.deepEqual(groupBpItemsBySectionMap(undefined), {});
  });

  it('applique le regroupement section par section indépendamment', () => {
    const map = {
      Son: [
        { id: 1, reference: 'M1', description: 'Micro', quantity: 1 },
        { id: 2, reference: 'M1', description: 'Micro', quantity: 1 },
      ],
      Lumière: [{ id: 3, reference: 'L1', description: 'Lyre', quantity: 1 }],
    };
    const out = groupBpItemsBySectionMap(map);
    assert.equal(out['Son'].length, 1);
    assert.equal(out['Son'][0].quantity, 2);
    assert.equal(out['Lumière'].length, 1);
    assert.equal(out['Lumière'][0].quantity, 1);
  });
});
