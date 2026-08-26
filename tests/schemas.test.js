#!/usr/bin/env node
/**
 * Tests des schémas Zod — validation imports eM@g
 *
 * Usage : node --test tests/schemas.test.js
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { personnelImportSchema, affaireSchema } from '../apps/api/schemas/imports.js';

// Note : equipmentImportSchema retiré avec la suppression de la route
// /api/equipment/import-csv (remplacée par l'import Locmat dual CSV).

// ══════════════════════════════════════════
// personnelImportSchema
// ══════════════════════════════════════════
describe('personnelImportSchema', () => {
  it('accepte un import minimal', () => {
    const result = personnelImportSchema.safeParse({
      data: [{ nom: 'Dupont', prenom: 'Jean' }],
      mode: 'preview',
    });
    assert.ok(result.success);
  });

  it('rejette si data vide', () => {
    const result = personnelImportSchema.safeParse({ data: [], mode: 'import' });
    assert.ok(!result.success);
  });

  it('rejette sans mode', () => {
    const result = personnelImportSchema.safeParse({ data: [{ nom: 'X' }] });
    assert.ok(!result.success);
  });
});

// ══════════════════════════════════════════
// savImportSchema — supprimé : voir tests/sav-comparator.test.js
// pour la nouvelle pipeline d'import LocMat.
// ══════════════════════════════════════════

// ══════════════════════════════════════════
// affaireSchema
// ══════════════════════════════════════════
describe('affaireSchema', () => {
  it('accepte une affaire minimale', () => {
    const result = affaireSchema.safeParse({ numero_affaire: 'AF12345' });
    assert.ok(result.success);
  });

  it('accepte une affaire complète', () => {
    const result = affaireSchema.safeParse({
      numero_affaire: 'AF99999',
      type: 'Prestation',
      client: 'Client SA',
      client_id: 1,
      date_debut: '2026-04-01',
      date_fin: '2026-04-05',
      notes: 'Notes de test',
    });
    assert.ok(result.success);
  });

  it('rejette sans numero_affaire', () => {
    const result = affaireSchema.safeParse({ type: 'Vente' });
    assert.ok(!result.success);
  });

  it('rejette si numero_affaire trop long', () => {
    const result = affaireSchema.safeParse({ numero_affaire: 'A'.repeat(51) });
    assert.ok(!result.success);
  });

  it('accepte client_id null', () => {
    const result = affaireSchema.safeParse({ numero_affaire: 'AF001', client_id: null });
    assert.ok(result.success);
  });
});
