// Tests unitaires du helper de diff d'import commande fournisseur (L8 — 3.2).
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  applyImportDiff,
  diffOrderItems,
  makeItemKey,
} from '../apps/api/services/orderImportDiff.js';

// ── makeItemKey ────────────────────────────────────────────
test('makeItemKey: priorité au ref_code (uppercase, sans espaces)', () => {
  assert.equal(makeItemKey({ ref_code: ' abc-123 ', designation: 'Anything' }), 'R:ABC-123');
  assert.equal(makeItemKey({ ref_code: 'a 1 2', designation: 'x' }), 'R:A12');
});

test('makeItemKey: fallback désignation normalisée (accents + casse + espaces)', () => {
  assert.equal(makeItemKey({ designation: 'Console NUMÉRIQUE' }), 'D:console numerique');
  assert.equal(makeItemKey({ designation: '  Câble   XLR  3m ' }), 'D:cable xlr 3m');
});

test('makeItemKey: ref_code vide → fallback désignation', () => {
  assert.equal(makeItemKey({ ref_code: '   ', designation: 'X' }), 'D:x');
});

test('makeItemKey: item null-safe', () => {
  assert.equal(makeItemKey(null), 'D:');
  assert.equal(makeItemKey({}), 'D:');
});

// ── diffOrderItems : cas de base ───────────────────────────
test('diffOrderItems: ajout pur (commande vide)', () => {
  const diff = diffOrderItems(
    [],
    [
      { ref_code: 'A1', designation: 'Cable', quantity: 3, unit_price_ht: 10 },
      { ref_code: 'A2', designation: 'Connecteur', quantity: 5, unit_price_ht: 2.5 },
    ],
  );
  assert.equal(diff.added.length, 2);
  assert.equal(diff.updated.length, 0);
  assert.equal(diff.unchanged.length, 0);
  assert.equal(diff.conflicts.length, 0);
  assert.equal(diff.summary.addedCount, 2);
});

test('diffOrderItems: identique → unchanged', () => {
  const existing = [
    { id: 1, ref_code: 'A1', designation: 'Cable', quantity: 3, unit_price_ht: 10 },
  ];
  const incoming = [{ ref_code: 'A1', designation: 'Cable', quantity: 3, unit_price_ht: 10 }];
  const diff = diffOrderItems(existing, incoming);
  assert.equal(diff.unchanged.length, 1);
  assert.equal(diff.unchanged[0].existingId, 1);
  assert.equal(diff.added.length, 0);
  assert.equal(diff.updated.length, 0);
});

test('diffOrderItems: quantité différente → updated avec suggestion sum', () => {
  const existing = [
    { id: 7, ref_code: 'A1', designation: 'Cable', quantity: 3, unit_price_ht: 10 },
  ];
  const incoming = [{ ref_code: 'A1', designation: 'Cable', quantity: 2, unit_price_ht: 10 }];
  const diff = diffOrderItems(existing, incoming);
  assert.equal(diff.updated.length, 1);
  const u = diff.updated[0];
  assert.equal(u.existingId, 7);
  assert.equal(u.changes.quantity, true);
  assert.equal(u.changes.price, false);
  assert.equal(u.suggested.quantity, 5); // 3 + 2
  assert.equal(u.suggested.unit_price_ht, 10);
});

test('diffOrderItems: quantité différente, mode replace → suggestion = incoming', () => {
  const existing = [
    { id: 7, ref_code: 'A1', designation: 'Cable', quantity: 3, unit_price_ht: 10 },
  ];
  const incoming = [{ ref_code: 'A1', designation: 'Cable', quantity: 2, unit_price_ht: 10 }];
  const diff = diffOrderItems(existing, incoming, { quantityMode: 'replace' });
  assert.equal(diff.updated[0].suggested.quantity, 2);
});

test('diffOrderItems: prix différent au-delà de epsilon → updated', () => {
  const existing = [{ id: 1, ref_code: 'A1', designation: 'X', quantity: 1, unit_price_ht: 10 }];
  const incoming = [{ ref_code: 'A1', designation: 'X', quantity: 1, unit_price_ht: 11.5 }];
  const diff = diffOrderItems(existing, incoming);
  assert.equal(diff.updated.length, 1);
  assert.equal(diff.updated[0].changes.price, true);
  assert.equal(diff.updated[0].suggested.unit_price_ht, 11.5);
});

test('diffOrderItems: prix dans la tolérance epsilon → unchanged', () => {
  const existing = [{ id: 1, ref_code: 'A1', designation: 'X', quantity: 1, unit_price_ht: 10.0 }];
  const incoming = [{ ref_code: 'A1', designation: 'X', quantity: 1, unit_price_ht: 10.005 }];
  const diff = diffOrderItems(existing, incoming);
  assert.equal(diff.unchanged.length, 1);
});

// ── Doublons & conflits ─────────────────────────────────────
test('diffOrderItems: doublons dans incoming → fusion des quantités', () => {
  const incoming = [
    { ref_code: 'A1', designation: 'Cable', quantity: 2, unit_price_ht: 10 },
    { ref_code: 'A1', designation: 'Cable', quantity: 3, unit_price_ht: 10 },
  ];
  const diff = diffOrderItems([], incoming);
  assert.equal(diff.added.length, 1);
  assert.equal(diff.added[0].item.quantity, 5);
  assert.equal(diff.added[0].item._mergedFrom, 2);
});

test('diffOrderItems: doublons dans incoming + match existing → updated', () => {
  const existing = [
    { id: 1, ref_code: 'A1', designation: 'Cable', quantity: 1, unit_price_ht: 10 },
  ];
  const incoming = [
    { ref_code: 'A1', designation: 'Cable', quantity: 2, unit_price_ht: 10 },
    { ref_code: 'A1', designation: 'Cable', quantity: 3, unit_price_ht: 10 },
  ];
  const diff = diffOrderItems(existing, incoming);
  assert.equal(diff.added.length, 0);
  assert.equal(diff.updated.length, 1);
  assert.equal(diff.updated[0].suggested.quantity, 6); // 1 + (2+3)
});

test('diffOrderItems: plusieurs lignes existantes pour une même clé → conflict', () => {
  const existing = [
    { id: 1, ref_code: 'A1', designation: 'Cable', quantity: 1, unit_price_ht: 10 },
    { id: 2, ref_code: 'A1', designation: 'Cable', quantity: 4, unit_price_ht: 12 },
  ];
  const incoming = [{ ref_code: 'A1', designation: 'Cable', quantity: 2, unit_price_ht: 10 }];
  const diff = diffOrderItems(existing, incoming);
  assert.equal(diff.conflicts.length, 1);
  assert.equal(diff.conflicts[0].reason, 'multiple_existing');
  assert.equal(diff.conflicts[0].existingCount, 2);
  assert.equal(diff.updated.length, 0);
});

// ── Matching par désignation (sans ref_code) ─────────────────
test('diffOrderItems: match par désignation normalisée (accents/casse)', () => {
  const existing = [{ id: 1, designation: 'Câble XLR 3m', quantity: 2, unit_price_ht: 5 }];
  const incoming = [{ designation: 'cable xlr 3m', quantity: 1, unit_price_ht: 5 }];
  const diff = diffOrderItems(existing, incoming);
  assert.equal(diff.updated.length, 1);
  assert.equal(diff.updated[0].suggested.quantity, 3);
});

test('diffOrderItems: ref_code prioritaire sur désignation (désignations différentes mais même ref)', () => {
  const existing = [
    { id: 1, ref_code: 'A1', designation: 'Vieux nom de la ligne', quantity: 1, unit_price_ht: 5 },
  ];
  const incoming = [
    { ref_code: 'A1', designation: 'Nouveau nom complet', quantity: 2, unit_price_ht: 5 },
  ];
  const diff = diffOrderItems(existing, incoming);
  assert.equal(diff.updated.length, 1);
  assert.equal(diff.updated[0].existingId, 1);
});

// ── Robustesse ──────────────────────────────────────────────
test('diffOrderItems: existing/incoming null-safe', () => {
  const diff = diffOrderItems(null, undefined);
  assert.equal(diff.added.length, 0);
  assert.equal(diff.summary.existingCount, 0);
  assert.equal(diff.summary.incomingCount, 0);
});

test('diffOrderItems: items null dans tableau ignorés sans crash', () => {
  const diff = diffOrderItems([null], [null, { designation: 'X', quantity: 1 }]);
  assert.equal(diff.added.length, 1);
});

// ── applyImportDiff ─────────────────────────────────────────
test('applyImportDiff: ajout + update par défaut (mode merge/sum)', () => {
  const existing = [
    { id: 1, ref_code: 'A1', designation: 'Cable', quantity: 1, unit_price_ht: 10 },
  ];
  const incoming = [
    { ref_code: 'A1', designation: 'Cable', quantity: 2, unit_price_ht: 10 }, // updated
    { ref_code: 'A2', designation: 'Connecteur', quantity: 5, unit_price_ht: 2 }, // added
  ];
  const diff = diffOrderItems(existing, incoming);
  const { items, actions } = applyImportDiff(existing, diff);
  assert.equal(actions.added, 1);
  assert.equal(actions.updated, 1);
  assert.equal(actions.skipped, 0);
  assert.equal(items.length, 2);
  const a1 = items.find((it) => it.id === 1);
  assert.equal(a1.quantity, 3); // 1 + 2
  const a2 = items.find((it) => it.ref_code === 'A2');
  assert.equal(a2.quantity, 5);
});

test('applyImportDiff: décision skip ignore une ligne', () => {
  const existing = [{ id: 1, ref_code: 'A1', designation: 'C', quantity: 1, unit_price_ht: 10 }];
  const incoming = [{ ref_code: 'A1', designation: 'C', quantity: 2, unit_price_ht: 10 }];
  const diff = diffOrderItems(existing, incoming);
  const key = diff.updated[0].key;
  const { items, actions } = applyImportDiff(existing, diff, { perKey: { [key]: 'skip' } });
  assert.equal(actions.skipped, 1);
  assert.equal(actions.updated, 0);
  assert.equal(items[0].quantity, 1); // inchangé
});

test("applyImportDiff: décision add force une nouvelle ligne au lieu de l'update", () => {
  const existing = [{ id: 1, ref_code: 'A1', designation: 'C', quantity: 1, unit_price_ht: 10 }];
  const incoming = [{ ref_code: 'A1', designation: 'C', quantity: 2, unit_price_ht: 10 }];
  const diff = diffOrderItems(existing, incoming);
  const key = diff.updated[0].key;
  const { items, actions } = applyImportDiff(existing, diff, { perKey: { [key]: 'add' } });
  assert.equal(actions.added, 1);
  assert.equal(actions.updated, 0);
  assert.equal(items.length, 2);
  assert.equal(items[0].quantity, 1); // existant intact
  assert.equal(items[1].quantity, 2); // nouvelle ligne
});

test('applyImportDiff: conflicts ne sont pas appliqués automatiquement', () => {
  const existing = [
    { id: 1, ref_code: 'A1', designation: 'C', quantity: 1, unit_price_ht: 10 },
    { id: 2, ref_code: 'A1', designation: 'C', quantity: 4, unit_price_ht: 12 },
  ];
  const incoming = [{ ref_code: 'A1', designation: 'C', quantity: 2, unit_price_ht: 10 }];
  const diff = diffOrderItems(existing, incoming);
  const { items, actions } = applyImportDiff(existing, diff);
  assert.equal(actions.added, 0);
  assert.equal(actions.updated, 0);
  assert.equal(items.length, 2);
  assert.equal(diff.conflicts.length, 1);
});
