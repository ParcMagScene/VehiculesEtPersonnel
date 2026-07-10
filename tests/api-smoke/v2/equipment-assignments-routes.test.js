#!/usr/bin/env node
/**
 * Tests smoke — v2/equipmentAssignmentsRoutes (T-P1-08).
 */

import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

import express from 'express';

import {
  EQ_ASSIGN_PROTOCOL_VERSION,
  EQ_ASSIGN_V2_CAPABILITIES,
  EQ_ASSIGN_V2_FLAG,
  setupEquipmentAssignmentsV2Routes,
} from '../../../apps/api/v2/equipmentAssignmentsRoutes.js';

function fakeAuth(req, _res, next) {
  req.user = { id: 1 };
  next();
}
function buildApp(flagOn) {
  const app = express();
  app.use(express.json());
  if (flagOn) process.env[EQ_ASSIGN_V2_FLAG] = '1';
  else delete process.env[EQ_ASSIGN_V2_FLAG];
  setupEquipmentAssignmentsV2Routes(app, fakeAuth);
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
  flagBackup = process.env[EQ_ASSIGN_V2_FLAG];
});
after(() => {
  if (flagBackup === undefined) delete process.env[EQ_ASSIGN_V2_FLAG];
  else process.env[EQ_ASSIGN_V2_FLAG] = flagBackup;
});

describe('v2/equipmentAssignmentsRoutes — constantes', () => {
  it('semver + flag canonique + capabilities frozen kebab-case', () => {
    assert.match(EQ_ASSIGN_PROTOCOL_VERSION, /^\d+\.\d+\.\d+$/);
    assert.equal(EQ_ASSIGN_V2_FLAG, 'FEATURE_V2_EQUIPMENT_ASSIGNMENTS');
    assert.ok(Object.isFrozen(EQ_ASSIGN_V2_CAPABILITIES));
    for (const c of EQ_ASSIGN_V2_CAPABILITIES) assert.match(c, /^[a-z][a-z0-9-]*$/);
    assert.ok(EQ_ASSIGN_V2_CAPABILITIES.includes('double-assignment-blocked-v1'));
    assert.ok(EQ_ASSIGN_V2_CAPABILITIES.includes('assignment-create-audited-v1'));
  });
});

describe('v2/equipmentAssignmentsRoutes — feature flag', () => {
  it('off -> 404', async () => {
    const res = await get(buildApp(false), '/api/v2/equipment-assignments/protocol');
    assert.equal(res.status, 404);
    assert.equal(res.body.code, 'FEATURE_DISABLED');
  });

  it('on -> 200 protocol', async () => {
    const res = await get(buildApp(true), '/api/v2/equipment-assignments/protocol');
    assert.equal(res.status, 200);
    assert.equal(res.body.data.protocol_version, EQ_ASSIGN_PROTOCOL_VERSION);
    assert.ok(res.body.data.legacy_endpoints.includes('/api/equipment-assignments/*'));
  });
});

describe('v2/equipmentAssignmentsRoutes — setup validation', () => {
  it('throw si app invalide', () => {
    assert.throws(() => setupEquipmentAssignmentsV2Routes(null, fakeAuth), TypeError);
  });
  it('throw si auth invalide', () => {
    assert.throws(() => setupEquipmentAssignmentsV2Routes(express(), null), TypeError);
  });
  it('setup minimal OK', () => {
    setupEquipmentAssignmentsV2Routes(express(), fakeAuth);
  });
});
