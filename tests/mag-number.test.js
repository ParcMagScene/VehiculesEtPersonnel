#!/usr/bin/env node
/**
 * Tests unitaires — module partagé magNumber.js
 * Usage : node --test tests/mag-number.test.js
 *
 * Règles métier (spec 2026-05-20, resserrées 2026-05-20 PM) :
 *   • MAG = EXACTEMENT 1 LETTRE + 2 CHIFFRES (ex T01, E09, V12, B99)
 *   • Séparateur strict ` - ` (au moins un espace de chaque côté)
 *   • Sans espaces autour du tiret ⇒ PAS un MAG
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  isMagNumber,
  MAG_NUMBER_RE,
  normalizeMagNumber,
  parseMagSerial,
} from '../apps/api/services/magNumber.js';

describe('normalizeMagNumber / MAG_NUMBER_RE', () => {
  it('accepte les formats 1 lettre + 2 chiffres valides', () => {
    for (const v of ['T01', 'E09', 'A12', 'V12', 'B99', 'Z00']) {
      assert.equal(normalizeMagNumber(v), v.toUpperCase(), `attendu valide: ${v}`);
      assert.ok(MAG_NUMBER_RE.test(v.toUpperCase()), `regex doit matcher ${v}`);
      assert.equal(isMagNumber(v), true);
    }
  });

  it('rejette les formats invalides', () => {
    for (const v of [
      '', // vide
      null, // nullish
      'T', // pas de chiffre
      '123', // pas de lettre
      'T-01', // séparateur dans le MAG
      '12T', // chiffres avant lettres
      'TA01BC', // lettres après chiffres
      'P1', // 1 seul chiffre
      'P123', // 3 chiffres
      'T1', // 1 seul chiffre
      'VX1', // 2 lettres
      'VX14', // 2 lettres
      'AB12', // 2 lettres
      'ABC1234', // 3 lettres + 4 chiffres
      'ABCD123', // 4 lettres (>3)
      'A12345', // 5 chiffres (>4)
    ]) {
      assert.equal(normalizeMagNumber(v), null, `attendu invalide: ${String(v)}`);
      assert.equal(isMagNumber(v), false);
    }
  });

  it('normalise les minuscules et trim', () => {
    assert.equal(normalizeMagNumber('  t01 '), 'T01');
    assert.equal(normalizeMagNumber('e09'), 'E09');
  });
});

describe('parseMagSerial', () => {
  it('extrait le MAG en préfixe avec séparateur " - "', () => {
    assert.deepEqual(parseMagSerial('T01 - 2400953513'), {
      coreSerial: '2400953513',
      magNumber: 'T01',
    });
    assert.deepEqual(parseMagSerial('V12 - 2400953513'), {
      coreSerial: '2400953513',
      magNumber: 'V12',
    });
    assert.deepEqual(parseMagSerial('E09 - ABCD-1234'), {
      coreSerial: 'ABCD-1234',
      magNumber: 'E09',
    });
  });

  it('extrait le MAG en suffixe', () => {
    assert.deepEqual(parseMagSerial('0788770045 - V12'), {
      coreSerial: '0788770045',
      magNumber: 'V12',
    });
  });

  it('tolère plusieurs espaces autour du tiret', () => {
    assert.deepEqual(parseMagSerial('T01 -  2400953513'), {
      coreSerial: '2400953513',
      magNumber: 'T01',
    });
    assert.deepEqual(parseMagSerial('0788770045   - V12'), {
      coreSerial: '0788770045',
      magNumber: 'V12',
    });
  });

  it("REFUSE quand le tiret n'est pas entouré d'espaces", () => {
    // Spec: sans espaces ⇒ PAS un MAG → on retourne la chaîne brute en serial.
    assert.deepEqual(parseMagSerial('T01-2400953513'), {
      coreSerial: 'T01-2400953513',
      magNumber: null,
    });
    assert.deepEqual(parseMagSerial('T01 -2400953513'), {
      coreSerial: 'T01 -2400953513',
      magNumber: null,
    });
    assert.deepEqual(parseMagSerial('T01- 2400953513'), {
      coreSerial: 'T01- 2400953513',
      magNumber: null,
    });
  });

  it('REFUSE les formats hors 1 lettre + 2 chiffres', () => {
    // VX1 (2L+1C) n'est plus reconnu comme MAG depuis 2026-05-20 PM.
    assert.deepEqual(parseMagSerial('VX1 - 2400953513'), {
      coreSerial: 'VX1 - 2400953513',
      magNumber: null,
    });
    assert.deepEqual(parseMagSerial('VX14 - 95'), {
      coreSerial: 'VX14 - 95',
      magNumber: null,
    });
    assert.deepEqual(parseMagSerial('P1 - SN'), {
      coreSerial: 'P1 - SN',
      magNumber: null,
    });
  });

  it('retourne le serial brut quand aucun MAG détectable', () => {
    assert.deepEqual(parseMagSerial('B884971'), { coreSerial: 'B884971', magNumber: null });
    assert.deepEqual(parseMagSerial('2400953513'), { coreSerial: '2400953513', magNumber: null });
    assert.deepEqual(parseMagSerial(''), { coreSerial: '', magNumber: null });
    assert.deepEqual(parseMagSerial(null), { coreSerial: '', magNumber: null });
    assert.deepEqual(parseMagSerial(undefined), { coreSerial: '', magNumber: null });
  });

  it('refuse les ambiguïtés où les deux côtés sont des MAG', () => {
    // Les deux côtés matchent : on ne tranche pas → pas d'extraction.
    assert.deepEqual(parseMagSerial('T01 - V12'), {
      coreSerial: 'T01 - V12',
      magNumber: null,
    });
  });

  it('refuse les chaînes avec plusieurs " - " (split ambigu)', () => {
    // 3 segments ⇒ on ne peut pas trancher.
    assert.deepEqual(parseMagSerial('T01 - SN-X - 2400'), {
      coreSerial: 'T01 - SN-X - 2400',
      magNumber: null,
    });
  });
});
