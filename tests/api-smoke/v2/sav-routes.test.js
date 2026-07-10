#!/usr/bin/env node
/**
 * Tests smoke — v2/savRoutes (T-P1-07).
 */

import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

import express from 'express';

import {
  SAV_PROTOCOL_VERSION,
  SAV_V2_CAPABILITIES,
  SAV_V2_FLAG,
  setupSavV2Routes,
} from '../../../apps/api/v2/savRoutes.js';

function fakeAuth(req, _res, next) {
  req.user = { id: 1 };
  next();
}

function buildApp(flagOn) {
  const app = express();
  app.use(express.json());
  if (flagOn) process.env[SAV_V2_FLAG] = '1';
  else delete process.env[SAV_V2_FLAG];
  setupSavV2Routes(app, fakeAuth);
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
  flagBackup = process.env[SAV_V2_FLAG];
});
after(() => {
  if (flagBackup === undefined) delete process.env[SAV_V2_FLAG];
  else process.env[SAV_V2_FLAG] = flagBackup;
});

describe('v2/savRoutes — constantes (T-P1-07)', () => {
  it('SAV_PROTOCOL_VERSION semver + flag canonique', () => {
    assert.match(SAV_PROTOCOL_VERSION, /^\d+\.\d+\.\d+$/);
    assert.equal(SAV_V2_FLAG, 'FEATURE_V2_SAV');
  });

  it('SAV_V2_CAPABILITIES frozen kebab-case', () => {
    assert.ok(Object.isFrozen(SAV_V2_CAPABILITIES));
    for (const c of SAV_V2_CAPABILITIES) assert.match(c, /^[a-z][a-z0-9-]*$/);
    for (const c of [
      'protocol-discovery',
      'parts-list-v1',
      'parts-add-v1',
      'parts-status-update-v1',
      'ticket-transition-v1',
    ]) {
      assert.ok(SAV_V2_CAPABILITIES.includes(c), `contient ${c}`);
    }
  });
});

describe('v2/savRoutes — feature flag', () => {
  it('off -> 404 FEATURE_DISABLED', async () => {
    const res = await get(buildApp(false), '/api/v2/sav/protocol');
    assert.equal(res.status, 404);
    assert.equal(res.body.code, 'FEATURE_DISABLED');
  });

  it('on -> 200 protocol avec part_statuses + allowed_ticket_transitions', async () => {
    const res = await get(buildApp(true), '/api/v2/sav/protocol');
    assert.equal(res.status, 200);
    assert.equal(res.body.data.protocol_version, SAV_PROTOCOL_VERSION);
    assert.ok(Array.isArray(res.body.data.part_statuses));
    assert.ok(res.body.data.part_statuses.includes('installed'));
    assert.ok(res.body.data.allowed_ticket_transitions);
    assert.ok(Array.isArray(res.body.data.allowed_ticket_transitions.open));
  });
});

describe('v2/savRoutes — setup validation', () => {
  it('throw si app invalide', () => {
    assert.throws(() => setupSavV2Routes(null, fakeAuth), TypeError);
  });
  it('throw si auth invalide', () => {
    assert.throws(() => setupSavV2Routes(express(), null), TypeError);
  });
  it('accepte un setup minimal', () => {
    setupSavV2Routes(express(), fakeAuth);
  });
});
