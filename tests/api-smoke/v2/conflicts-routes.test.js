#!/usr/bin/env node
/**
 * Tests smoke — v2/conflictsRoutes (T-P1-05).
 */

import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

import express from 'express';

import {
  CONFLICTS_PROTOCOL_VERSION,
  CONFLICTS_V2_CAPABILITIES,
  CONFLICTS_V2_FLAG,
  setupConflictsV2Routes,
} from '../../../apps/api/v2/conflictsRoutes.js';

function fakeAuth(req, _res, next) {
  req.user = { id: 1 };
  next();
}

function buildApp(flagOn) {
  const app = express();
  app.use(express.json());
  if (flagOn) process.env[CONFLICTS_V2_FLAG] = '1';
  else delete process.env[CONFLICTS_V2_FLAG];
  setupConflictsV2Routes(app, fakeAuth);
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
  flagBackup = process.env[CONFLICTS_V2_FLAG];
});
after(() => {
  if (flagBackup === undefined) delete process.env[CONFLICTS_V2_FLAG];
  else process.env[CONFLICTS_V2_FLAG] = flagBackup;
});

describe('v2/conflictsRoutes — constantes (T-P1-05)', () => {
  it('CONFLICTS_PROTOCOL_VERSION semver + flag canonique', () => {
    assert.match(CONFLICTS_PROTOCOL_VERSION, /^\d+\.\d+\.\d+$/);
    assert.equal(CONFLICTS_V2_FLAG, 'FEATURE_V2_CONFLICTS');
  });

  it('CONFLICTS_V2_CAPABILITIES frozen kebab-case', () => {
    assert.ok(Object.isFrozen(CONFLICTS_V2_CAPABILITIES));
    for (const c of CONFLICTS_V2_CAPABILITIES) assert.match(c, /^[a-z][a-z0-9-]*$/);
    assert.ok(CONFLICTS_V2_CAPABILITIES.includes('person-conflict-check-v1'));
  });
});

describe('v2/conflictsRoutes — feature flag', () => {
  it('off -> 404 FEATURE_DISABLED', async () => {
    const app = buildApp(false);
    const res = await get(app, '/api/v2/conflicts/protocol');
    assert.equal(res.status, 404);
    assert.equal(res.body.code, 'FEATURE_DISABLED');
  });

  it('on -> 200 protocol avec sources_scanned attendues', async () => {
    const app = buildApp(true);
    const res = await get(app, '/api/v2/conflicts/protocol');
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.protocol_version, CONFLICTS_PROTOCOL_VERSION);
    assert.ok(Array.isArray(res.body.data.sources_scanned));
    assert.ok(res.body.data.sources_scanned.includes('availabilities'));
    assert.ok(res.body.data.sources_scanned.includes('task_assignments'));
  });
});

describe('v2/conflictsRoutes — setup validation', () => {
  it('throw si app invalide', () => {
    assert.throws(() => setupConflictsV2Routes(null, fakeAuth), TypeError);
  });

  it('throw si auth invalide', () => {
    assert.throws(() => setupConflictsV2Routes(express(), null), TypeError);
  });

  it('accepte un setup minimal', () => {
    setupConflictsV2Routes(express(), fakeAuth);
  });
});
