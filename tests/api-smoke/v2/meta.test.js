#!/usr/bin/env node
/**
 * Tests unitaires — v2/metaRoutes (T-P1-01).
 *
 * Couvre :
 *   - isFlagEnabled : parseur env aligne featureFlag.js.
 *   - buildMetaPayload : registre statique + agregation flags.
 *   - Route GET /api/v2/meta : public, structure de reponse.
 *   - V2_NAMESPACES frozen + ordre alphabetique.
 */

import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

import express from 'express';

import {
  buildMetaPayload,
  isFlagEnabled,
  META_PROTOCOL_VERSION,
  setupV2MetaRoutes,
  V2_NAMESPACES,
} from '../../../apps/api/v2/metaRoutes.js';

async function get(app, path) {
  const server = app.listen(0);
  const port = server.address().port;
  try {
    const res = await fetch(`http://127.0.0.1:${port}${path}`);
    const body = await res.json().catch(() => null);
    return { status: res.status, body };
  } finally {
    server.close();
  }
}

// Sauvegarde et restauration des flags v2 pour ne pas polluer les
// autres tests qui tournent en parallele.
const V2_FLAGS = [
  'FEATURE_V2_PLANNING',
  'FEATURE_V2_DISPLAY',
  'FEATURE_V2_LOCATIONS',
  'FEATURE_V2_AFFAIRES',
  'FEATURE_V2_LEAVES',
  'FEATURE_V2_CONFLICTS',
  'FEATURE_V2_EQUIPMENT_UID',
  'FEATURE_V2_SAV',
];
const flagBackup = {};

before(() => {
  for (const f of V2_FLAGS) {
    flagBackup[f] = process.env[f];
    delete process.env[f];
  }
});

after(() => {
  for (const f of V2_FLAGS) {
    if (flagBackup[f] === undefined) delete process.env[f];
    else process.env[f] = flagBackup[f];
  }
});

describe('v2/metaRoutes — V2_NAMESPACES registre (T-P1-01)', () => {
  it('est gele (Object.freeze) niveau top + entrees', () => {
    assert.ok(Object.isFrozen(V2_NAMESPACES));
    for (const ns of V2_NAMESPACES) {
      assert.ok(Object.isFrozen(ns), `namespace ${ns.name} figes`);
    }
  });

  it('contient exactement les 8 namespaces (affaires/conflicts/display/equipment-uid/leaves/locations/planning/sav)', () => {
    const names = V2_NAMESPACES.map((n) => n.name);
    assert.deepEqual(names, [
      'affaires',
      'conflicts',
      'display',
      'equipment-uid',
      'leaves',
      'locations',
      'planning',
      'sav',
    ]);
  });

  it('chaque namespace expose les champs requis', () => {
    for (const ns of V2_NAMESPACES) {
      assert.match(ns.protocol_version, /^\d+\.\d+\.\d+$/, `${ns.name} semver`);
      assert.match(ns.flag, /^FEATURE_V2_[A-Z][A-Z_]*$/, `${ns.name} flag`);
      assert.ok(ns.base_path.startsWith('/api/v2/'), `${ns.name} base_path`);
      assert.ok(ns.docs.startsWith('/docs/api/v2/'), `${ns.name} docs`);
      assert.ok(Array.isArray(ns.capabilities), `${ns.name} capabilities`);
      assert.ok(ns.capabilities.length > 0, `${ns.name} au moins 1 capability`);
    }
  });
});

describe('v2/metaRoutes — isFlagEnabled', () => {
  it('accepte 1 / true / on / yes (case-insensitive)', () => {
    for (const v of ['1', 'true', 'True', 'TRUE', 'on', 'ON', 'yes', 'YES']) {
      assert.equal(isFlagEnabled({ F: v }, 'F'), true, `"${v}" -> true`);
    }
  });

  it('refuse 0 / false / off / no / vide / absent', () => {
    for (const v of ['0', 'false', 'FALSE', 'off', 'OFF', 'no', 'NO', '']) {
      assert.equal(isFlagEnabled({ F: v }, 'F'), false, `"${v}" -> false`);
    }
    assert.equal(isFlagEnabled({}, 'F'), false);
    assert.equal(isFlagEnabled({ F: undefined }, 'F'), false);
    assert.equal(isFlagEnabled(null, 'F'), false);
  });
});

describe('v2/metaRoutes — buildMetaPayload', () => {
  it('all flags off -> enabled_count=0', () => {
    const payload = buildMetaPayload({}, { now: () => '2026-07-10T00:00:00Z' });
    assert.equal(payload.meta_protocol_version, META_PROTOCOL_VERSION);
    assert.equal(typeof payload.response_protocol_version, 'number');
    assert.equal(payload.generated_at, '2026-07-10T00:00:00Z');
    assert.equal(payload.total_namespaces, 8);
    assert.equal(payload.enabled_count, 0);
    for (const ns of payload.namespaces) assert.equal(ns.enabled, false);
  });

  it('all flags on -> enabled_count=8', () => {
    const env = {
      FEATURE_V2_PLANNING: '1',
      FEATURE_V2_DISPLAY: '1',
      FEATURE_V2_LOCATIONS: '1',
      FEATURE_V2_AFFAIRES: '1',
      FEATURE_V2_LEAVES: '1',
      FEATURE_V2_CONFLICTS: '1',
      FEATURE_V2_EQUIPMENT_UID: '1',
      FEATURE_V2_SAV: '1',
    };
    const payload = buildMetaPayload(env);
    assert.equal(payload.enabled_count, 8);
    for (const ns of payload.namespaces) assert.equal(ns.enabled, true);
  });

  it('subset : seul FEATURE_V2_PLANNING actif -> enabled_count=1 sur planning', () => {
    const payload = buildMetaPayload({ FEATURE_V2_PLANNING: 'true' });
    assert.equal(payload.enabled_count, 1);
    const planning = payload.namespaces.find((n) => n.name === 'planning');
    assert.equal(planning.enabled, true);
    for (const ns of payload.namespaces) {
      if (ns.name !== 'planning') assert.equal(ns.enabled, false);
    }
  });

  it('generated_at par defaut = timestamp ISO en injection auto', () => {
    const payload = buildMetaPayload({});
    assert.match(payload.generated_at, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  it('capabilities clonees (pas de reference frozen leak)', () => {
    const payload = buildMetaPayload({});
    for (const ns of payload.namespaces) {
      // Le clone doit permettre push (contrairement au frozen source).
      assert.doesNotThrow(() => ns.capabilities.push('test-marker'));
    }
  });
});

describe('v2/metaRoutes — GET /api/v2/meta', () => {
  it("route publique (pas d'auth) — 200 avec structure attendue", async () => {
    const app = express();
    setupV2MetaRoutes(app);
    const res = await get(app, '/api/v2/meta');
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.meta_protocol_version, META_PROTOCOL_VERSION);
    assert.equal(res.body.data.total_namespaces, 8);
    assert.equal(res.body.data.enabled_count, 0);
    assert.ok(Array.isArray(res.body.data.namespaces));
    const names = res.body.data.namespaces.map((n) => n.name);
    assert.deepEqual(names, [
      'affaires',
      'conflicts',
      'display',
      'equipment-uid',
      'leaves',
      'locations',
      'planning',
      'sav',
    ]);
  });

  it("reflete l'etat reel des flags process.env", async () => {
    process.env.FEATURE_V2_AFFAIRES = '1';
    process.env.FEATURE_V2_LOCATIONS = '1';
    try {
      const app = express();
      setupV2MetaRoutes(app);
      const res = await get(app, '/api/v2/meta');
      assert.equal(res.status, 200);
      assert.equal(res.body.data.enabled_count, 2);
      const affaires = res.body.data.namespaces.find((n) => n.name === 'affaires');
      const planning = res.body.data.namespaces.find((n) => n.name === 'planning');
      assert.equal(affaires.enabled, true);
      assert.equal(planning.enabled, false);
    } finally {
      delete process.env.FEATURE_V2_AFFAIRES;
      delete process.env.FEATURE_V2_LOCATIONS;
    }
  });

  it('setupV2MetaRoutes throw si app invalide', () => {
    assert.throws(() => setupV2MetaRoutes(null), TypeError);
    assert.throws(() => setupV2MetaRoutes({}), TypeError);
  });
});
