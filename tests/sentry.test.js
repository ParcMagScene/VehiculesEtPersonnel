/**
 * tests/sentry.test.js — [S2-4] Tests du stub Sentry observabilité
 *
 * Couvre :
 *  - initSentry() no-op si SENTRY_DSN absent
 *  - initSentry() loggue warn si DSN défini sans @sentry/node installé
 *  - sentryRequestHandler() / sentryErrorHandler() transparents quand désactivés
 *  - captureException() / captureMessage() ne lèvent jamais
 *  - Idempotence
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  _getSentryState,
  _resetSentryForTests,
  captureException,
  captureMessage,
  initSentry,
  sentryErrorHandler,
  sentryRequestHandler,
} from '../apps/api/observability/sentry.js';

test('initSentry : no-op si SENTRY_DSN absent', async () => {
  _resetSentryForTests();
  delete process.env.SENTRY_DSN;
  const enabled = await initSentry();
  assert.equal(enabled, false);
  assert.equal(_getSentryState().enabled, false);
});

test('initSentry : idempotent (2 appels = même état)', async () => {
  _resetSentryForTests();
  delete process.env.SENTRY_DSN;
  await initSentry();
  const second = await initSentry();
  assert.equal(second, false);
});

test('initSentry : DSN défini sans @sentry/node installé → false (warn loggué)', async () => {
  _resetSentryForTests();
  process.env.SENTRY_DSN = 'https://fake@example.invalid/1';
  const enabled = await initSentry();
  // @sentry/node n'est pas installé en dev : on attend false sans throw
  assert.equal(enabled, false);
  delete process.env.SENTRY_DSN;
});

test('sentryRequestHandler : passe à next() quand désactivé', () => {
  _resetSentryForTests();
  const mw = sentryRequestHandler();
  let called = false;
  mw({}, {}, () => {
    called = true;
  });
  assert.equal(called, true);
});

test('sentryErrorHandler : forward err à next() quand désactivé', () => {
  _resetSentryForTests();
  const mw = sentryErrorHandler();
  const err = new Error('boom');
  let received;
  mw(err, {}, {}, (e) => {
    received = e;
  });
  assert.equal(received, err);
});

test('captureException / captureMessage : no-op silencieux quand désactivé', () => {
  _resetSentryForTests();
  assert.doesNotThrow(() => captureException(new Error('x'), { foo: 1 }));
  assert.doesNotThrow(() => captureMessage('hello', 'warning'));
});
