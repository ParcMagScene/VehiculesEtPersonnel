#!/usr/bin/env node
/**
 * Tests smoke — v2/leavesRoutes (T-P1-04).
 */

import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

import express from 'express';

import {
  LEAVES_PROTOCOL_VERSION,
  LEAVES_V2_CAPABILITIES,
  LEAVES_V2_FLAG,
  setupLeavesV2Routes,
} from '../../../apps/api/v2/leavesRoutes.js';

function fakeAuth(req, _res, next) {
  req.user = { id: 1, name: 'test' };
  next();
}

function buildApp(flagOn) {
  const app = express();
  app.use(express.json());
  if (flagOn) process.env[LEAVES_V2_FLAG] = '1';
  else delete process.env[LEAVES_V2_FLAG];
  setupLeavesV2Routes(app, fakeAuth);
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
  flagBackup = process.env[LEAVES_V2_FLAG];
});
after(() => {
  if (flagBackup === undefined) delete process.env[LEAVES_V2_FLAG];
  else process.env[LEAVES_V2_FLAG] = flagBackup;
});

describe('v2/leavesRoutes — constantes (T-P1-04)', () => {
  it('LEAVES_PROTOCOL_VERSION semver + LEAVES_V2_FLAG canonique', () => {
    assert.match(LEAVES_PROTOCOL_VERSION, /^\d+\.\d+\.\d+$/);
    assert.equal(LEAVES_V2_FLAG, 'FEATURE_V2_LEAVES');
  });

  it('LEAVES_V2_CAPABILITIES frozen + kebab-case + attendus', () => {
    assert.ok(Object.isFrozen(LEAVES_V2_CAPABILITIES));
    for (const cap of LEAVES_V2_CAPABILITIES) assert.match(cap, /^[a-z][a-z0-9-]*$/);
    for (const c of [
      'protocol-discovery',
      'calculate-period-v1',
      'balance-self-service-v1',
      'balance-admin-v1',
    ]) {
      assert.ok(LEAVES_V2_CAPABILITIES.includes(c), `contient ${c}`);
    }
  });
});

describe('v2/leavesRoutes — feature flag', () => {
  it('flag off -> 404 FEATURE_DISABLED sur /protocol', async () => {
    const app = buildApp(false);
    const res = await get(app, '/api/v2/leaves/protocol');
    assert.equal(res.status, 404);
    assert.equal(res.body.success, false);
    assert.equal(res.body.code, 'FEATURE_DISABLED');
  });

  it('flag on -> 200 sur /protocol avec structure attendue', async () => {
    const app = buildApp(true);
    const res = await get(app, '/api/v2/leaves/protocol');
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.protocol_version, LEAVES_PROTOCOL_VERSION);
    assert.deepEqual(res.body.data.capabilities, [...LEAVES_V2_CAPABILITIES]);
    assert.ok(res.body.data.legacy_endpoints.includes('/api/leaves/calculate'));
  });
});

describe('v2/leavesRoutes — setup validation', () => {
  it('throw si app invalide', () => {
    assert.throws(() => setupLeavesV2Routes(null, fakeAuth), TypeError);
    assert.throws(() => setupLeavesV2Routes({}, fakeAuth), TypeError);
  });

  it('throw si authenticateToken absent', () => {
    const app = express();
    assert.throws(() => setupLeavesV2Routes(app, null), TypeError);
  });

  it('accepte un setup minimal', () => {
    const app = express();
    setupLeavesV2Routes(app, fakeAuth);
  });
});
