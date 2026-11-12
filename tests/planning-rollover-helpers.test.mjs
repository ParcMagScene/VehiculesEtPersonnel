#!/usr/bin/env node
/**
 * Tests unitaires — planningRolloverHelpers (L5 méga-prompt 4.1)
 * Usage : node --test tests/planning-rollover-helpers.test.mjs
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  addOneDayToDateStr,
  formatLocalDate,
  shouldRunDailyRollover,
  subtractOneDayFromDateStr,
} from '../apps/api/services/planningRolloverHelpers.js';

describe('formatLocalDate', () => {
  it('formate au format YYYY-MM-DD', () => {
    const d = new Date(2026, 4, 20); // 20 mai 2026 (mois 0-indexé)
    assert.equal(formatLocalDate(d), '2026-05-20');
  });

  it('zero-pad mois et jour', () => {
    assert.equal(formatLocalDate(new Date(2026, 0, 5)), '2026-01-05');
    assert.equal(formatLocalDate(new Date(2026, 11, 31)), '2026-12-31');
  });

  it('rejette les Date invalides ou non-Date', () => {
    assert.throws(() => formatLocalDate(null), TypeError);
    assert.throws(() => formatLocalDate('2026-05-20'), TypeError);
    assert.throws(() => formatLocalDate(new Date('invalide')), TypeError);
  });
});

describe('addOneDayToDateStr', () => {
  it('ajoute un jour à une date normale', () => {
    assert.equal(addOneDayToDateStr('2026-05-20'), '2026-05-21');
  });

  it('gère le passage de mois', () => {
    assert.equal(addOneDayToDateStr('2026-05-31'), '2026-06-01');
  });

  it("gère le passage d'année", () => {
    assert.equal(addOneDayToDateStr('2026-12-31'), '2027-01-01');
  });

  it('gère le 28 février année non bissextile', () => {
    assert.equal(addOneDayToDateStr('2026-02-28'), '2026-03-01');
  });

  it('gère le 28 février année bissextile (2024)', () => {
    assert.equal(addOneDayToDateStr('2024-02-28'), '2024-02-29');
    assert.equal(addOneDayToDateStr('2024-02-29'), '2024-03-01');
  });

  it('rejette les formats invalides', () => {
    assert.throws(() => addOneDayToDateStr('2026-5-20'), TypeError);
    assert.throws(() => addOneDayToDateStr('20-05-2026'), TypeError);
    assert.throws(() => addOneDayToDateStr(''), TypeError);
    assert.throws(() => addOneDayToDateStr(null), TypeError);
    assert.throws(() => addOneDayToDateStr(20260520), TypeError);
  });
});

describe('subtractOneDayFromDateStr', () => {
  it('retire un jour à une date normale', () => {
    assert.equal(subtractOneDayFromDateStr('2026-05-20'), '2026-05-19');
  });

  it('gère le passage en mois précédent', () => {
    assert.equal(subtractOneDayFromDateStr('2026-06-01'), '2026-05-31');
  });

  it("gère le passage d'année", () => {
    assert.equal(subtractOneDayFromDateStr('2026-01-01'), '2025-12-31');
  });

  it('gère le 1er mars année bissextile', () => {
    assert.equal(subtractOneDayFromDateStr('2024-03-01'), '2024-02-29');
  });

  it('rejette les formats invalides', () => {
    assert.throws(() => subtractOneDayFromDateStr('2026-5-20'), TypeError);
    assert.throws(() => subtractOneDayFromDateStr(undefined), TypeError);
  });
});

describe('shouldRunDailyRollover', () => {
  it('rattrape le rollover manqué même après minuit', () => {
    const late = new Date(2026, 9, 21, 7, 30);
    assert.equal(shouldRunDailyRollover(late, '2026-10-20'), true);
  });

  it('ne relance pas le rollover déjà exécuté pour la date locale', () => {
    const later = new Date(2026, 9, 21, 7, 30);
    assert.equal(shouldRunDailyRollover(later, '2026-10-21'), false);
  });

  it('retourne false pour un instant invalide', () => {
    assert.equal(shouldRunDailyRollover(new Date('invalide'), null), false);
  });
});
