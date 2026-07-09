#!/usr/bin/env node
/**
 * Tests smoke — v2/displayRoutes (T-P0-14).
 *
 * Vérifie :
 * - Discovery endpoint public (pas d'authentification).
 * - Skeletons /config, /content, /signals répondent 501 avec meta.
 * - Feature flag off → 404 FEATURE_DISABLED.
 * - Feature flag on → endpoints montés.
 * - protocol_version cohérent avec la constante exportée.
 */

import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

import express from 'express';

import {
  DISPLAY_PROTOCOL_VERSION,
  DISPLAY_V2_CAPABILITIES,
  DISPLAY_V2_FLAG,
  setupDisplayV2Routes,
} from '../../../apps/api/v2/displayRoutes.js';

// Faux authenticateToken : passe systématiquement (les tests d'auth réels
// sont côté planning-feature-flag.test.js pour le middleware générique).
function fakeAuth(req, _res, next) {
  req.user = { id: 1, name: 'test' };
  next();
}

/**
 * Construit une app Express minimale + monte le namespace v2 Display.
 * @param {boolean} flagOn Si true, définit FEATURE_V2_DISPLAY=1 dans process.env.
 */
function buildApp(flagOn) {
  const app = express();
  if (flagOn) {
    process.env[DISPLAY_V2_FLAG] = '1';
  } else {
    delete process.env[DISPLAY_V2_FLAG];
  }
  setupDisplayV2Routes(app, fakeAuth);
  return app;
}

/**
 * Helper de test HTTP via fetch sur un serveur ad-hoc.
 * @param {import('express').Express} app
 * @param {string} path
 * @returns {Promise<{ status: number, body: any }>}
 */
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
  flagBackup = process.env[DISPLAY_V2_FLAG];
});

after(() => {
  if (flagBackup === undefined) delete process.env[DISPLAY_V2_FLAG];
  else process.env[DISPLAY_V2_FLAG] = flagBackup;
});

describe('v2/displayRoutes — constants (T-P0-14)', () => {
  it('DISPLAY_PROTOCOL_VERSION est une chaîne semver', () => {
    assert.match(DISPLAY_PROTOCOL_VERSION, /^\d+\.\d+\.\d+$/);
  });

  it('DISPLAY_V2_FLAG vaut "FEATURE_V2_DISPLAY"', () => {
    assert.equal(DISPLAY_V2_FLAG, 'FEATURE_V2_DISPLAY');
  });

  it('DISPLAY_V2_CAPABILITIES est un tableau immutable non vide', () => {
    assert.ok(Array.isArray(DISPLAY_V2_CAPABILITIES));
    assert.ok(DISPLAY_V2_CAPABILITIES.length > 0);
    assert.ok(Object.isFrozen(DISPLAY_V2_CAPABILITIES));
    for (const cap of DISPLAY_V2_CAPABILITIES) {
      assert.match(cap, /^[a-z][a-z0-9-]*$/, `capability kebab-case: ${cap}`);
    }
  });
});

describe('v2/displayRoutes — flag off', () => {
  it('GET /api/v2/display/protocol → 404 FEATURE_DISABLED', async () => {
    const app = buildApp(false);
    const { status, body } = await get(app, '/api/v2/display/protocol');
    assert.equal(status, 404);
    assert.equal(body?.success, false);
    assert.equal(body?.code, 'FEATURE_DISABLED');
    assert.equal(body?.meta?.flag, DISPLAY_V2_FLAG);
  });

  it('GET /api/v2/display/config → 404 FEATURE_DISABLED (même auth requise)', async () => {
    const app = buildApp(false);
    const { status, body } = await get(app, '/api/v2/display/config');
    assert.equal(status, 404);
    assert.equal(body?.code, 'FEATURE_DISABLED');
  });
});

describe('v2/displayRoutes — flag on', () => {
  it('GET /api/v2/display/protocol → 200 avec protocol_version + capabilities', async () => {
    const app = buildApp(true);
    const { status, body } = await get(app, '/api/v2/display/protocol');
    assert.equal(status, 200);
    assert.equal(body?.success, true);
    assert.equal(body?.data?.protocol_version, DISPLAY_PROTOCOL_VERSION);
    assert.ok(Array.isArray(body?.data?.capabilities));
    assert.equal(body.data.capabilities.length, DISPLAY_V2_CAPABILITIES.length);
    assert.equal(body?.data?.legacy_namespace, '/api/display');
    assert.equal(typeof body?.meta?.protocol_version, 'number');
  });

  it('GET /api/v2/display/config sans screen_id → 400 VALIDATION_ERROR', async () => {
    const app = buildApp(true);
    const { status, body } = await get(app, '/api/v2/display/config');
    assert.equal(status, 400);
    assert.equal(body?.success, false);
    assert.equal(body?.code, 'VALIDATION_ERROR');
    assert.match(body?.error || '', /screenId/);
  });

  it('GET /api/v2/display/content sans playlist_id → 400 VALIDATION_ERROR', async () => {
    const app = buildApp(true);
    const { status, body } = await get(app, '/api/v2/display/content');
    assert.equal(status, 400);
    assert.equal(body?.code, 'VALIDATION_ERROR');
    assert.match(body?.error || '', /playlistId/);
  });

  it('GET /api/v2/display/signals sans screen_id → 400 VALIDATION_ERROR', async () => {
    const app = buildApp(true);
    const { status, body } = await get(app, '/api/v2/display/signals');
    assert.equal(status, 400);
    assert.equal(body?.code, 'VALIDATION_ERROR');
    assert.match(body?.error || '', /screenId/);
  });
});

describe('v2/displayRoutes — validation d\'API', () => {
  it('setupDisplayV2Routes rejette une app non-Express', () => {
    assert.throws(() => setupDisplayV2Routes(null, fakeAuth), /Express/);
    assert.throws(() => setupDisplayV2Routes({}, fakeAuth), /Express/);
  });

  it('setupDisplayV2Routes rejette authenticateToken non-fonction', () => {
    const app = express();
    assert.throws(() => setupDisplayV2Routes(app, null), /authenticateToken/);
    assert.throws(() => setupDisplayV2Routes(app, 'not-a-fn'), /authenticateToken/);
  });
});
