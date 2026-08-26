#!/usr/bin/env node
/**
 * Tests smoke — v2/affairesRoutes (T-P0-09).
 *
 * Verifie :
 *   - Discovery public (avec flag on).
 *   - Feature flag off → 404 FEATURE_DISABLED.
 *   - Constantes semver + kebab-case + frozen.
 *   - Validation `setupAffairesV2Routes` (Express, authenticateToken).
 */

import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

import express from 'express';

import {
  AFFAIRES_PROTOCOL_VERSION,
  AFFAIRES_V2_CAPABILITIES,
  AFFAIRES_V2_FLAG,
  setupAffairesV2Routes,
} from '../../../apps/api/v2/affairesRoutes.js';

function fakeAuth(req, _res, next) {
  req.user = { id: 1, name: 'test', isAdmin: true };
  next();
}

function buildApp(flagOn) {
  const app = express();
  app.use(express.json());
  if (flagOn) {
    process.env[AFFAIRES_V2_FLAG] = '1';
  } else {
    delete process.env[AFFAIRES_V2_FLAG];
  }
  setupAffairesV2Routes(app, fakeAuth);
  return app;
}

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

let flagBackup;

before(() => {
  flagBackup = process.env[AFFAIRES_V2_FLAG];
});

after(() => {
  if (flagBackup === undefined) delete process.env[AFFAIRES_V2_FLAG];
  else process.env[AFFAIRES_V2_FLAG] = flagBackup;
});

describe('v2/affairesRoutes — constants (T-P0-09)', () => {
  it('AFFAIRES_PROTOCOL_VERSION est une chaine semver', () => {
    assert.match(AFFAIRES_PROTOCOL_VERSION, /^\d+\.\d+\.\d+$/);
  });

  it('AFFAIRES_V2_FLAG vaut "FEATURE_V2_AFFAIRES"', () => {
    assert.equal(AFFAIRES_V2_FLAG, 'FEATURE_V2_AFFAIRES');
  });

  it('AFFAIRES_V2_CAPABILITIES est un tableau immutable kebab-case', () => {
    assert.ok(Array.isArray(AFFAIRES_V2_CAPABILITIES));
    assert.ok(Object.isFrozen(AFFAIRES_V2_CAPABILITIES));
    for (const cap of AFFAIRES_V2_CAPABILITIES) {
      assert.match(cap, /^[a-z][a-z0-9-]*$/);
    }
    assert.ok(AFFAIRES_V2_CAPABILITIES.includes('protocol-discovery'));
    assert.ok(AFFAIRES_V2_CAPABILITIES.includes('affaires-list-cursor-v1'));
    assert.ok(AFFAIRES_V2_CAPABILITIES.includes('affaire-patch-audited-v1'));
  });
});

describe('v2/affairesRoutes — feature flag (T-P0-09)', () => {
  it('flag off → 404 FEATURE_DISABLED sur /protocol', async () => {
    const app = buildApp(false);
    const res = await get(app, '/api/v2/affaires/protocol');
    assert.equal(res.status, 404);
    assert.equal(res.body.success, false);
    assert.equal(res.body.code, 'FEATURE_DISABLED');
  });

  it('flag on → 200 sur /protocol avec structure attendue', async () => {
    const app = buildApp(true);
    const res = await get(app, '/api/v2/affaires/protocol');
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.protocol_version, AFFAIRES_PROTOCOL_VERSION);
    assert.deepEqual(res.body.data.capabilities, [...AFFAIRES_V2_CAPABILITIES]);
    assert.ok(Array.isArray(res.body.data.legacy_endpoints));
    assert.ok(res.body.data.legacy_endpoints.includes('/api/affaires'));
    assert.ok(Array.isArray(res.body.data.patch_fields));
    assert.ok(res.body.data.patch_fields.length > 0);
  });
});

describe('v2/affairesRoutes — setup validation (T-P0-09)', () => {
  it('throw si app absent ou invalide', () => {
    assert.throws(() => setupAffairesV2Routes(null, fakeAuth), TypeError);
    assert.throws(() => setupAffairesV2Routes({}, fakeAuth), TypeError);
  });

  it("throw si authenticateToken n'est pas une fonction", () => {
    const app = express();
    assert.throws(() => setupAffairesV2Routes(app, null), TypeError);
    assert.throws(() => setupAffairesV2Routes(app, 'no'), TypeError);
  });

  it('accepte un setup minimal (Express + authenticateToken)', () => {
    const app = express();
    setupAffairesV2Routes(app, fakeAuth);
  });
});
