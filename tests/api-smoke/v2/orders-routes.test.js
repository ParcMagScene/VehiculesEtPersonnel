#!/usr/bin/env node
/**
 * Tests smoke — v2/ordersRoutes (T-P1-09).
 */

import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

import express from 'express';

import {
  ORDERS_PROTOCOL_VERSION,
  ORDERS_V2_CAPABILITIES,
  ORDERS_V2_FLAG,
  setupOrdersV2Routes,
} from '../../../apps/api/v2/ordersRoutes.js';

function fakeAuth(req, _res, next) {
  req.user = { id: 1 };
  next();
}
function buildApp(flagOn) {
  const app = express();
  app.use(express.json());
  if (flagOn) process.env[ORDERS_V2_FLAG] = '1';
  else delete process.env[ORDERS_V2_FLAG];
  setupOrdersV2Routes(app, fakeAuth);
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
  flagBackup = process.env[ORDERS_V2_FLAG];
});
after(() => {
  if (flagBackup === undefined) delete process.env[ORDERS_V2_FLAG];
  else process.env[ORDERS_V2_FLAG] = flagBackup;
});

describe('v2/ordersRoutes — constantes (T-P1-09)', () => {
  it('semver + flag canonique + capabilities frozen kebab-case', () => {
    assert.match(ORDERS_PROTOCOL_VERSION, /^\d+\.\d+\.\d+$/);
    assert.equal(ORDERS_V2_FLAG, 'FEATURE_V2_ORDERS');
    assert.ok(Object.isFrozen(ORDERS_V2_CAPABILITIES));
    for (const c of ORDERS_V2_CAPABILITIES) assert.match(c, /^[a-z][a-z0-9-]*$/);
    assert.ok(ORDERS_V2_CAPABILITIES.includes('order-transition-v1'));
    assert.ok(ORDERS_V2_CAPABILITIES.includes('quote-transition-v1'));
  });
});

describe('v2/ordersRoutes — feature flag', () => {
  it('off -> 404', async () => {
    const res = await get(buildApp(false), '/api/v2/orders/protocol');
    assert.equal(res.status, 404);
    assert.equal(res.body.code, 'FEATURE_DISABLED');
  });

  it('on -> 200 protocol avec order_transitions + quote_transitions', async () => {
    const res = await get(buildApp(true), '/api/v2/orders/protocol');
    assert.equal(res.status, 200);
    assert.ok(res.body.data.order_transitions);
    assert.ok(res.body.data.quote_transitions);
    assert.ok(Array.isArray(res.body.data.order_transitions.draft));
    assert.ok(res.body.data.order_transitions.draft.includes('sent'));
  });
});

describe('v2/ordersRoutes — setup validation', () => {
  it('throw si app invalide', () => {
    assert.throws(() => setupOrdersV2Routes(null, fakeAuth), TypeError);
  });
  it('throw si auth invalide', () => {
    assert.throws(() => setupOrdersV2Routes(express(), null), TypeError);
  });
  it('setup minimal OK', () => {
    setupOrdersV2Routes(express(), fakeAuth);
  });
});
