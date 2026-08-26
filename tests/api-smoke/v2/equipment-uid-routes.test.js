#!/usr/bin/env node
/**
 * Tests smoke — v2/equipmentUidRoutes (T-P1-06).
 */

import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

import express from 'express';

import {
  EQUIPMENT_UID_PROTOCOL_VERSION,
  EQUIPMENT_UID_V2_CAPABILITIES,
  EQUIPMENT_UID_V2_FLAG,
  setupEquipmentUidV2Routes,
} from '../../../apps/api/v2/equipmentUidRoutes.js';

function fakeAuth(req, _res, next) {
  req.user = { id: 1, is_admin: 1 };
  next();
}
function fakeAdmin(_req, _res, next) {
  next();
}

function buildApp(flagOn) {
  const app = express();
  app.use(express.json());
  if (flagOn) process.env[EQUIPMENT_UID_V2_FLAG] = '1';
  else delete process.env[EQUIPMENT_UID_V2_FLAG];
  setupEquipmentUidV2Routes(app, fakeAuth, fakeAdmin);
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
  flagBackup = process.env[EQUIPMENT_UID_V2_FLAG];
});
after(() => {
  if (flagBackup === undefined) delete process.env[EQUIPMENT_UID_V2_FLAG];
  else process.env[EQUIPMENT_UID_V2_FLAG] = flagBackup;
});

describe('v2/equipmentUidRoutes — constantes (T-P1-06)', () => {
  it('EQUIPMENT_UID_PROTOCOL_VERSION semver + flag canonique', () => {
    assert.match(EQUIPMENT_UID_PROTOCOL_VERSION, /^\d+\.\d+\.\d+$/);
    assert.equal(EQUIPMENT_UID_V2_FLAG, 'FEATURE_V2_EQUIPMENT_UID');
  });

  it('EQUIPMENT_UID_V2_CAPABILITIES frozen kebab-case', () => {
    assert.ok(Object.isFrozen(EQUIPMENT_UID_V2_CAPABILITIES));
    for (const c of EQUIPMENT_UID_V2_CAPABILITIES) assert.match(c, /^[a-z][a-z0-9-]*$/);
    assert.ok(EQUIPMENT_UID_V2_CAPABILITIES.includes('uid-regenerate-v1'));
    assert.ok(EQUIPMENT_UID_V2_CAPABILITIES.includes('uid-audit-v1'));
  });
});

describe('v2/equipmentUidRoutes — feature flag', () => {
  it('off -> 404 FEATURE_DISABLED', async () => {
    const res = await get(buildApp(false), '/api/v2/equipment-uid/protocol');
    assert.equal(res.status, 404);
    assert.equal(res.body.code, 'FEATURE_DISABLED');
  });

  it('on -> 200 protocol', async () => {
    const res = await get(buildApp(true), '/api/v2/equipment-uid/protocol');
    assert.equal(res.status, 200);
    assert.equal(res.body.data.protocol_version, EQUIPMENT_UID_PROTOCOL_VERSION);
  });
});

describe('v2/equipmentUidRoutes — setup validation', () => {
  it('throw si app invalide', () => {
    assert.throws(() => setupEquipmentUidV2Routes(null, fakeAuth), TypeError);
  });
  it('throw si auth invalide', () => {
    assert.throws(() => setupEquipmentUidV2Routes(express(), null), TypeError);
  });
  it('accepte un setup minimal (sans requireAdmin)', () => {
    setupEquipmentUidV2Routes(express(), fakeAuth);
  });
});
