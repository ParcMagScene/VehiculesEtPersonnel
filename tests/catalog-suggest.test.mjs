// Tests du helper de scoring/ranking pour l'autocomplete catalogue (L9 — 3.3).
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  parseSuggestQuery,
  rankSuggestions,
  scoreSuggestion,
} from '../apps/api/services/catalogSuggest.js';

// ── parseSuggestQuery ───────────────────────────────────────
test('parseSuggestQuery: vide → isEmpty', () => {
  const q = parseSuggestQuery('   ');
  assert.equal(q.isEmpty, true);
  assert.equal(q.tokens.length, 0);
  assert.equal(q.like, '');
});

test('parseSuggestQuery: normalise accents/casse/espaces multiples', () => {
  const q = parseSuggestQuery('  CÂble   XLR  ');
  assert.equal(q.normalized, 'cable xlr');
  assert.deepEqual(q.tokens, ['cable', 'xlr']);
  assert.equal(q.like, '%cable xlr%');
  assert.equal(q.prefix, 'cable xlr%');
});

test('parseSuggestQuery: null-safe', () => {
  const q = parseSuggestQuery(null);
  assert.equal(q.isEmpty, true);
  assert.equal(q.raw, '');
});

// ── scoreSuggestion : ladder de pertinence ──────────────────
const Q = (s) => parseSuggestQuery(s);

test('scoreSuggestion: query vide → 0', () => {
  assert.equal(scoreSuggestion({ designation: 'X' }, Q('')), 0);
});

test('scoreSuggestion: supplier_ref exact = 100', () => {
  const s = scoreSuggestion({ supplier_ref: 'ABC-123', designation: 'Console' }, Q('abc-123'));
  assert.equal(s, 100);
});

test('scoreSuggestion: supplier_ref préfixe = 90', () => {
  const s = scoreSuggestion({ supplier_ref: 'ABC-123', designation: 'Console' }, Q('abc'));
  assert.equal(s, 90);
});

test('scoreSuggestion: designation préfixe = 70', () => {
  const s = scoreSuggestion({ supplier_ref: 'X', designation: 'Console numérique' }, Q('console'));
  assert.equal(s, 70);
});

test('scoreSuggestion: mot intérieur préfixé = 60', () => {
  const s = scoreSuggestion({ designation: 'Câble XLR 3m' }, Q('xlr'));
  assert.equal(s, 60);
});

test('scoreSuggestion: substring designation = 40', () => {
  // "midi" est sous-chaîne du mot "AmidiX" mais aucun mot ne commence par "midi" → 40
  const s = scoreSuggestion({ designation: 'AmidiX' }, Q('midi'));
  assert.equal(s, 40);
});

test('scoreSuggestion: brand contient = 20', () => {
  const s = scoreSuggestion({ designation: 'XX', brand: 'Allen & Heath' }, Q('allen'));
  assert.equal(s, 20);
});

test('scoreSuggestion: aucun match = 0', () => {
  assert.equal(scoreSuggestion({ designation: 'XX', brand: 'Y' }, Q('zzz')), 0);
});

test('scoreSuggestion: bonus tous les tokens présents en désignation (+5)', () => {
  // "console" matche en préfixe (70), "numérique" en plus → +5
  const s = scoreSuggestion({ designation: 'Console numérique 24 voies' }, Q('console numerique'));
  // 'console numerique' = 17 chars, designation normalisée 'console numerique 24 voies' starts with 'console numerique' → 70 + bonus 5
  assert.equal(s, 75);
});

test('scoreSuggestion: bonus supplier_id préféré (+3)', () => {
  const base = scoreSuggestion({ designation: 'Console', supplier_id: 42 }, Q('console'));
  const boosted = scoreSuggestion({ designation: 'Console', supplier_id: 42 }, Q('console'), {
    preferSupplierId: 42,
  });
  assert.equal(boosted - base, 3);
});

test('scoreSuggestion: supplier_id différent = pas de bonus', () => {
  const s = scoreSuggestion({ designation: 'Console', supplier_id: 99 }, Q('console'), {
    preferSupplierId: 42,
  });
  assert.equal(s, 70);
});

// ── rankSuggestions ─────────────────────────────────────────
test('rankSuggestions: tri par score décroissant + tronque au limit', () => {
  const articles = [
    { id: 1, designation: 'Connecteur XLR', supplier_ref: 'C-1' }, // 60
    { id: 2, supplier_ref: 'XLR-PRO', designation: 'Pro' }, // 90
    { id: 3, supplier_ref: 'XLR', designation: 'Simple' }, // 100
    { id: 4, designation: 'Câble Audio XLR symétrique' }, // 60
  ];
  const out = rankSuggestions(articles, Q('xlr'), { limit: 2 });
  assert.equal(out.length, 2);
  assert.equal(out[0].id, 3);
  assert.equal(out[1].id, 2);
});

test('rankSuggestions: ex æquo → désignation la plus courte gagne', () => {
  const articles = [
    { id: 1, designation: 'Câble XLR 3 mètres mâle femelle pro' }, // 60
    { id: 2, designation: 'XLR' }, // 70 (préfixe)
    { id: 3, designation: 'Câble XLR' }, // 60
  ];
  const out = rankSuggestions(articles, Q('xlr'), { limit: 5 });
  assert.equal(out[0].id, 2); // score 70
  assert.equal(out[1].id, 3); // score 60, plus court que id=1
  assert.equal(out[2].id, 1);
});

test('rankSuggestions: query vide → [] toujours', () => {
  assert.deepEqual(rankSuggestions([{ id: 1, designation: 'X' }], Q('')), []);
});

test('rankSuggestions: articles à score 0 écartés', () => {
  const articles = [
    { id: 1, designation: 'Console', brand: 'Yamaha' }, // match
    { id: 2, designation: 'Autre', brand: 'Sony' }, // pas de match
  ];
  const out = rankSuggestions(articles, Q('console'));
  assert.equal(out.length, 1);
  assert.equal(out[0].id, 1);
});

test('rankSuggestions: limit borné [1..50]', () => {
  const arts = Array.from({ length: 100 }, (_, i) => ({
    id: i + 1,
    designation: `Item ${i + 1}`,
  }));
  const out = rankSuggestions(arts, Q('item'), { limit: 999 });
  assert.equal(out.length, 50);
  const out2 = rankSuggestions(arts, Q('item'), { limit: 0 });
  assert.equal(out2.length, 1);
});

test('rankSuggestions: chaque résultat porte _score', () => {
  const out = rankSuggestions([{ id: 1, designation: 'Console' }], Q('console'));
  assert.equal(out[0]._score, 70);
});

test('rankSuggestions: preferSupplierId remonte un article match équivalent', () => {
  const arts = [
    { id: 1, designation: 'Console', supplier_id: 1 },
    { id: 2, designation: 'Console', supplier_id: 7 },
  ];
  const out = rankSuggestions(arts, Q('console'), { preferSupplierId: 7 });
  assert.equal(out[0].id, 2); // boost +3
  assert.equal(out[1].id, 1);
});
