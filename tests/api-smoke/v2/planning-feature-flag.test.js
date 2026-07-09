#!/usr/bin/env node
/**
 * Tests unit — middleware/featureFlag.js (T-P0-03)
 *
 * Vérifie le middleware générique createFeatureFlagGuard.
 *
 * Usage : node --test tests/api-smoke/v2/planning-feature-flag.test.js
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  createFeatureFlagGuard,
  isFeatureFlagOn,
} from '../../../apps/api/middleware/featureFlag.js';

function makeReqRes() {
  const res = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
  const req = {};
  let nextCalled = false;
  const next = () => {
    nextCalled = true;
  };
  return { req, res, next, wasNextCalled: () => nextCalled };
}

describe('isFeatureFlagOn', () => {
  it('accepte 1 / true / yes / on (insensitive)', () => {
    assert.equal(isFeatureFlagOn('1'), true);
    assert.equal(isFeatureFlagOn('true'), true);
    assert.equal(isFeatureFlagOn('TRUE'), true);
    assert.equal(isFeatureFlagOn('yes'), true);
    assert.equal(isFeatureFlagOn('on'), true);
    assert.equal(isFeatureFlagOn('  On  '), true);
  });

  it('refuse 0 / false / no / off / absence', () => {
    assert.equal(isFeatureFlagOn('0'), false);
    assert.equal(isFeatureFlagOn('false'), false);
    assert.equal(isFeatureFlagOn('no'), false);
    assert.equal(isFeatureFlagOn('off'), false);
    assert.equal(isFeatureFlagOn(''), false);
    assert.equal(isFeatureFlagOn(undefined), false);
    assert.equal(isFeatureFlagOn(null), false);
  });
});

describe('createFeatureFlagGuard', () => {
  it('exige un envKey non vide', () => {
    assert.throws(() => createFeatureFlagGuard(), TypeError);
    assert.throws(() => createFeatureFlagGuard(''), TypeError);
    assert.throws(() => createFeatureFlagGuard(42), TypeError);
  });

  it('laisse passer si le flag est ON', () => {
    const guard = createFeatureFlagGuard('FEATURE_TEST', {
      getEnv: () => ({ FEATURE_TEST: '1' }),
    });
    const { req, res, next, wasNextCalled } = makeReqRes();
    guard(req, res, next);
    assert.equal(wasNextCalled(), true);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body, null);
  });

  it('renvoie 404 FEATURE_DISABLED si le flag est OFF', () => {
    const guard = createFeatureFlagGuard('FEATURE_TEST', {
      getEnv: () => ({ FEATURE_TEST: '0' }),
    });
    const { req, res, next, wasNextCalled } = makeReqRes();
    guard(req, res, next);
    assert.equal(wasNextCalled(), false);
    assert.equal(res.statusCode, 404);
    assert.equal(res.body.success, false);
    assert.equal(res.body.code, 'FEATURE_DISABLED');
    assert.equal(res.body.meta.flag, 'FEATURE_TEST');
  });

  it('renvoie 404 si le flag est absent', () => {
    const guard = createFeatureFlagGuard('FEATURE_TEST', {
      getEnv: () => ({}),
    });
    const { req, res, next, wasNextCalled } = makeReqRes();
    guard(req, res, next);
    assert.equal(wasNextCalled(), false);
    assert.equal(res.statusCode, 404);
    assert.equal(res.body.code, 'FEATURE_DISABLED');
  });
});
