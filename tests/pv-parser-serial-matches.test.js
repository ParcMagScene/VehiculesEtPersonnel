#!/usr/bin/env node
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { findSerialMatchesInText, normalizeStatut } from '../apps/api/services/pvParser.js';

describe('findSerialMatchesInText', () => {
  it('retrouve plusieurs séries exactes dans un PV multi-équipements', () => {
    const matches = findSerialMatchesInText('Palan M23133 et palan 906766', [
      'M23133',
      '906766',
      'S07350',
    ]);

    assert.deepEqual(matches, ['M23133', '906766']);
  });

  it('ignore les séries qui ne sont qu’une partie d’un autre identifiant', () => {
    const matches = findSerialMatchesInText('Référence XABC123Z, numéro AB', ['ABC123', 'AB']);

    assert.deepEqual(matches, []);
  });

  it('normalise les séparateurs, les accents et la casse sans répéter les résultats', () => {
    const matches = findSerialMatchesInText('Série : AB-12345', ['AB12345', 'AB12345']);

    assert.deepEqual(matches, ['AB12345']);
  });
});

describe('normalizeStatut', () => {
  it('ne classe jamais « non conforme » comme conforme', () => {
    assert.equal(normalizeStatut('Non conforme'), 'NON_CONFORME');
    assert.equal(normalizeStatut('Aucune observation'), 'CONFORME');
    assert.equal(normalizeStatut('Conforme'), 'CONFORME');
    assert.equal(normalizeStatut('Défavorable'), 'NON_CONFORME');
  });
});
