#!/usr/bin/env node
/**
 * Tests unit — utils/cursor.js (T-P0-03)
 *
 * Vérifie l'encodage / décodage cursor opaque base64url.
 *
 * Usage : node --test tests/api-smoke/v2/planning-cursor.test.js
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { decodeCursor, encodeCursor } from '../../../apps/api/utils/cursor.js';

describe('utils/cursor — encode/decode', () => {
  it('round-trip { date, id: number } → cursor → { date, id }', () => {
    const key = { date: '2026-07-08', id: 12345 };
    const cursor = encodeCursor(key);
    assert.equal(typeof cursor, 'string');
    assert.ok(cursor.length > 0);
    const decoded = decodeCursor(cursor);
    assert.deepEqual(decoded, key);
  });

  it('round-trip { date, id: string uuid-like } → cursor → { date, id }', () => {
    const key = { date: '2026-07-08', id: 'e2826456723c4079be9795b1fef459a1' };
    const cursor = encodeCursor(key);
    const decoded = decodeCursor(cursor);
    assert.deepEqual(decoded, key);
  });

  it('encodage produit du base64url (pas de +, /, =)', () => {
    const cursor = encodeCursor({ date: '2026-01-01', id: 1 });
    assert.ok(!cursor.includes('+'));
    assert.ok(!cursor.includes('/'));
    assert.ok(!cursor.includes('='));
  });

  it('decodeCursor renvoie null pour valeurs vides / absentes', () => {
    assert.equal(decodeCursor(null), null);
    assert.equal(decodeCursor(undefined), null);
    assert.equal(decodeCursor(''), null);
  });

  it('decodeCursor renvoie null pour valeurs non-string', () => {
    assert.equal(decodeCursor(42), null);
    assert.equal(decodeCursor({}), null);
    assert.equal(decodeCursor([]), null);
  });

  it('decodeCursor renvoie null pour base64 invalide', () => {
    assert.equal(decodeCursor('###not-base64###'), null);
  });

  it('decodeCursor renvoie null pour JSON valide mais champs manquants', () => {
    const badPayload = Buffer.from('{"x":1}', 'utf8')
      .toString('base64')
      .replace(/=+$/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');
    assert.equal(decodeCursor(badPayload), null);
  });

  it('decodeCursor renvoie null si date au mauvais format', () => {
    const badPayload = Buffer.from('{"d":"08/07/2026","i":1}', 'utf8')
      .toString('base64')
      .replace(/=+$/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');
    assert.equal(decodeCursor(badPayload), null);
  });

  it('decodeCursor renvoie null si id absent, non truthy ou type non support\u00e9', () => {
    const badPayload1 = Buffer.from('{"d":"2026-01-01","i":-1}', 'utf8')
      .toString('base64')
      .replace(/=+$/g, '');
    assert.equal(decodeCursor(badPayload1), null);
    const badPayload2 = Buffer.from('{"d":"2026-01-01","i":1.5}', 'utf8')
      .toString('base64')
      .replace(/=+$/g, '');
    assert.equal(decodeCursor(badPayload2), null);
    const badPayload3 = Buffer.from('{"d":"2026-01-01","i":""}', 'utf8')
      .toString('base64')
      .replace(/=+$/g, '');
    assert.equal(decodeCursor(badPayload3), null);
    const badPayload4 = Buffer.from('{"d":"2026-01-01","i":null}', 'utf8')
      .toString('base64')
      .replace(/=+$/g, '');
    assert.equal(decodeCursor(badPayload4), null);
  });

  it('encodeCursor rejette cl\u00e9 mal form\u00e9e', () => {
    assert.throws(() => encodeCursor({ date: '08/07/2026', id: 1 }), TypeError);
    assert.throws(() => encodeCursor({ date: '2026-07-08', id: 0 }), TypeError);
    assert.throws(() => encodeCursor({ date: '2026-07-08', id: -1 }), TypeError);
    assert.throws(() => encodeCursor({ date: '2026-07-08', id: '' }), TypeError);
    assert.throws(() => encodeCursor({ date: '2026-07-08', id: null }), TypeError);
    assert.throws(() => encodeCursor(null), TypeError);
  });
});
