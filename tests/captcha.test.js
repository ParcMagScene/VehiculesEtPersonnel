/**
 * tests/captcha.test.js — Module de vérification CAPTCHA Turnstile
 *
 * Couvre :
 *  - bypass quand TURNSTILE_SECRET_KEY absent
 *  - rejet quand token manquant et CAPTCHA activé
 *  - succès / échec selon la réponse du serveur Cloudflare (fetch mocké)
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { isCaptchaEnabled, verifyCaptcha } from '../apps/api/captcha.js';

const ORIGINAL_FETCH = global.fetch;
const ORIGINAL_KEY = process.env.TURNSTILE_SECRET_KEY;

function restore() {
  global.fetch = ORIGINAL_FETCH;
  if (ORIGINAL_KEY === undefined) delete process.env.TURNSTILE_SECRET_KEY;
  else process.env.TURNSTILE_SECRET_KEY = ORIGINAL_KEY;
}

test('captcha — désactivé si TURNSTILE_SECRET_KEY absent', async () => {
  delete process.env.TURNSTILE_SECRET_KEY;
  try {
    assert.equal(isCaptchaEnabled(), false);
    const res = await verifyCaptcha('whatever', '127.0.0.1');
    assert.equal(res.ok, true);
    assert.equal(res.reason, 'disabled');
  } finally {
    restore();
  }
});

test('captcha — token manquant rejeté quand activé', async () => {
  process.env.TURNSTILE_SECRET_KEY = 'test-secret';
  try {
    const res = await verifyCaptcha(null, '127.0.0.1');
    assert.equal(res.ok, false);
    assert.equal(res.reason, 'missing_token');
  } finally {
    restore();
  }
});

test('captcha — succès si Cloudflare répond success=true', async () => {
  process.env.TURNSTILE_SECRET_KEY = 'test-secret';
  global.fetch = async () => ({
    ok: true,
    json: async () => ({ success: true }),
  });
  try {
    const res = await verifyCaptcha('valid-token', '127.0.0.1');
    assert.equal(res.ok, true);
  } finally {
    restore();
  }
});

test('captcha — échec si Cloudflare répond success=false', async () => {
  process.env.TURNSTILE_SECRET_KEY = 'test-secret';
  global.fetch = async () => ({
    ok: true,
    json: async () => ({ success: false, 'error-codes': ['invalid-input-response'] }),
  });
  try {
    const res = await verifyCaptcha('bad-token', '127.0.0.1');
    assert.equal(res.ok, false);
    assert.equal(res.reason, 'invalid-input-response');
  } finally {
    restore();
  }
});

test('captcha — échec sur erreur réseau', async () => {
  process.env.TURNSTILE_SECRET_KEY = 'test-secret';
  global.fetch = async () => {
    throw new Error('network down');
  };
  try {
    const res = await verifyCaptcha('token', '127.0.0.1');
    assert.equal(res.ok, false);
    assert.equal(res.reason, 'network_error');
  } finally {
    restore();
  }
});
