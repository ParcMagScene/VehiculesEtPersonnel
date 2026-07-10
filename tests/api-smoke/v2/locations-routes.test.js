#!/usr/bin/env node
/**
 * Tests smoke — v2/locationsRoutes (T-P0-12).
 *
 * Vérifie :
 * - Discovery endpoint public.
 * - Feature flag off → 404 FEATURE_DISABLED sur toutes les routes.
 * - Constantes exportees (semver, kebab-case).
 */

import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

import express from 'express';

import {
  LOCATIONS_PROTOCOL_VERSION,
  LOCATIONS_V2_CAPABILITIES,
  LOCATIONS_V2_FLAG,
  setupLocationsV2Routes,
} from '../../../apps/api/v2/locationsRoutes.js';

function fakeAuth(req, _res, next) {
  req.user = { id: 1, name: 'test', isAdmin: true };
  next();
}

function fakeAdmin(_req, _res, next) {
  next();
}

function buildApp(flagOn) {
  const app = express();
  app.use(express.json());
  if (flagOn) {
    process.env[LOCATIONS_V2_FLAG] = '1';
  } else {
    delete process.env[LOCATIONS_V2_FLAG];
  }
  setupLocationsV2Routes(app, fakeAuth, fakeAdmin);
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
  flagBackup = process.env[LOCATIONS_V2_FLAG];
});

after(() => {
  if (flagBackup === undefined) delete process.env[LOCATIONS_V2_FLAG];
  else process.env[LOCATIONS_V2_FLAG] = flagBackup;
});

describe('v2/locationsRoutes — constants (T-P0-12)', () => {
  it('LOCATIONS_PROTOCOL_VERSION est une chaine semver', () => {
    assert.match(LOCATIONS_PROTOCOL_VERSION, /^\d+\.\d+\.\d+$/);
  });

  it('LOCATIONS_V2_FLAG vaut "FEATURE_V2_LOCATIONS"', () => {
    assert.equal(LOCATIONS_V2_FLAG, 'FEATURE_V2_LOCATIONS');
  });

  it('LOCATIONS_V2_CAPABILITIES est un tableau immutable kebab-case', () => {
    assert.ok(Array.isArray(LOCATIONS_V2_CAPABILITIES));
    assert.ok(Object.isFrozen(LOCATIONS_V2_CAPABILITIES));
    for (const cap of LOCATIONS_V2_CAPABILITIES) {
      assert.match(cap, /^[a-z][a-z0-9-]*$/);
    }
  });
});

describe('v2/locationsRoutes — flag off', () => {
  it('GET /api/v2/locations/protocol → 404 FEATURE_DISABLED', async () => {
    const app = buildApp(false);
    const { status, body } = await get(app, '/api/v2/locations/protocol');
    assert.equal(status, 404);
    assert.equal(body?.code, 'FEATURE_DISABLED');
    assert.equal(body?.meta?.flag, LOCATIONS_V2_FLAG);
  });

  it('GET /api/v2/locations/depots → 404 FEATURE_DISABLED', async () => {
    const app = buildApp(false);
    const { status, body } = await get(app, '/api/v2/locations/depots');
    assert.equal(status, 404);
    assert.equal(body?.code, 'FEATURE_DISABLED');
  });
});

describe('v2/locationsRoutes — flag on (routes sans DB)', () => {
  // On teste la couche routing / feature flag / handler d'erreurs sans
  // brancher une DB reelle (le module importe la DB globale). Les
  // tests services (locations-services.test.js) couvrent la logique
  // metier avec DB in-memory dediee.

  it('GET /api/v2/locations/protocol → 200 avec structure attendue', async () => {
    const app = buildApp(true);
    const { status, body } = await get(app, '/api/v2/locations/protocol');
    assert.equal(status, 200);
    assert.equal(body?.success, true);
    assert.equal(body?.data?.protocol_version, LOCATIONS_PROTOCOL_VERSION);
    assert.ok(Array.isArray(body?.data?.capabilities));
    assert.ok(Array.isArray(body?.data?.legacy_endpoints));
    assert.equal(body?.data?.docs, '/docs/api/v2/locations.md');
    assert.equal(typeof body?.meta?.protocol_version, 'number');
  });
});

describe('v2/locationsRoutes — validation d\'API', () => {
  it('setupLocationsV2Routes rejette app non-Express', () => {
    assert.throws(() => setupLocationsV2Routes(null, fakeAuth), /Express/);
  });

  it('setupLocationsV2Routes rejette authenticateToken non-fonction', () => {
    const app = express();
    assert.throws(() => setupLocationsV2Routes(app, null), /authenticateToken/);
  });

  it('setupLocationsV2Routes accepte requireAdmin optionnel', () => {
    const app = express();
    // Sans requireAdmin : ne throw pas.
    setupLocationsV2Routes(app, fakeAuth);
    const app2 = express();
    setupLocationsV2Routes(app2, fakeAuth, fakeAdmin);
  });
});
