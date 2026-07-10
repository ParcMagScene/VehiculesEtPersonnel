#!/usr/bin/env node
/**
 * Tests unitaires — services/eventBus + ws/auth + ws/namespaces/meta
 * + ws/index (helpers purs).
 *
 * Ticket T-P1-02.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createEventBus, MAX_LISTENERS_PER_TOPIC } from '../../../apps/api/services/eventBus.js';
import { extractTokenFromRequest, parseCookieHeader } from '../../../apps/api/ws/auth.js';
import {
  parseWebSocketUrl,
  WEBSOCKET_KNOWN_NAMESPACES,
  WEBSOCKET_PROTOCOL_VERSION,
  WEBSOCKET_URL_PREFIX,
  WEBSOCKET_V2_FLAG,
} from '../../../apps/api/ws/index.js';
import {
  buildHeartbeatPayload,
  DEFAULT_HEARTBEAT_INTERVAL_MS,
  handleMetaMessage,
  META_NAMESPACE_NAME,
  META_WS_PROTOCOL_VERSION,
} from '../../../apps/api/ws/namespaces/meta.js';

describe('services/eventBus', () => {
  it('publish declenche les subscribers du meme topic uniquement', () => {
    const bus = createEventBus();
    const events = [];
    const off1 = bus.subscribe('t1', (p) => events.push(['t1', p]));
    bus.subscribe('t2', (p) => events.push(['t2', p]));
    bus.publish('t1', { a: 1 });
    bus.publish('t2', { b: 2 });
    bus.publish('nope', {});
    assert.deepEqual(events, [
      ['t1', { a: 1 }],
      ['t2', { b: 2 }],
    ]);
    off1(); // idempotent
    off1();
    bus.publish('t1', { a: 3 });
    assert.equal(events.length, 2);
  });

  it('validation stricte : topic string non vide + listener function', () => {
    const bus = createEventBus();
    assert.throws(() => bus.publish('', 'x'), TypeError);
    assert.throws(() => bus.publish(null, 'x'), TypeError);
    assert.throws(() => bus.subscribe('', () => {}), TypeError);
    assert.throws(() => bus.subscribe('t', 'not a fn'), TypeError);
  });

  it('MAX_LISTENERS_PER_TOPIC >= 100 (supporte 100 clients simultanes)', () => {
    assert.ok(MAX_LISTENERS_PER_TOPIC >= 100);
  });

  it('topics() liste les topics ayant au moins 1 listener', () => {
    const bus = createEventBus();
    const off = bus.subscribe('t1', () => {});
    bus.subscribe('t2', () => {});
    assert.deepEqual(bus.topics().sort(), ['t1', 't2']);
    off();
    assert.deepEqual(bus.topics(), ['t2']);
  });
});

describe('ws/auth — parseCookieHeader', () => {
  it('parse un header simple', () => {
    assert.deepEqual(parseCookieHeader('a=1; b=2'), { a: '1', b: '2' });
  });

  it('gere les valeurs vides / manques', () => {
    assert.deepEqual(parseCookieHeader(''), {});
    assert.deepEqual(parseCookieHeader(undefined), {});
    assert.deepEqual(parseCookieHeader(null), {});
    assert.deepEqual(parseCookieHeader('a='), { a: '' });
  });

  it('decode les valeurs URL-encoded', () => {
    assert.deepEqual(parseCookieHeader('token=abc%20def'), { token: 'abc def' });
  });
});

describe('ws/auth — extractTokenFromRequest', () => {
  it('priorite : query ?token > Bearer > cookie', () => {
    const req = {
      url: '/api/v2/ws/meta?token=from-query',
      headers: { authorization: 'Bearer from-bearer', cookie: 'auth_token=from-cookie' },
    };
    assert.equal(extractTokenFromRequest(req), 'from-query');
  });

  it('Bearer prioritaire sur cookie quand pas de query token', () => {
    const req = { headers: { authorization: 'Bearer top', cookie: 'auth_token=fallback' } };
    assert.equal(extractTokenFromRequest(req), 'top');
  });

  it('fallback sur le cookie auth_token si pas de Bearer ni de query', () => {
    const req = { headers: { cookie: 'auth_token=xxx' } };
    assert.equal(extractTokenFromRequest(req), 'xxx');
  });

  it('null si aucun token', () => {
    assert.equal(extractTokenFromRequest({ headers: {} }), null);
    assert.equal(extractTokenFromRequest({ headers: { cookie: 'other=1' } }), null);
  });
});

describe('ws/index — parseWebSocketUrl', () => {
  it('extrait le namespace depuis /api/v2/ws/<ns>', () => {
    assert.deepEqual(parseWebSocketUrl('/api/v2/ws/meta'), {
      namespace: 'meta',
      queryToken: null,
    });
    assert.deepEqual(parseWebSocketUrl('/api/v2/ws/messaging'), {
      namespace: 'messaging',
      queryToken: null,
    });
  });

  it('extrait le token depuis la query string', () => {
    assert.deepEqual(parseWebSocketUrl('/api/v2/ws/meta?token=abc'), {
      namespace: 'meta',
      queryToken: 'abc',
    });
  });

  it('tolere le slash final', () => {
    assert.deepEqual(parseWebSocketUrl('/api/v2/ws/meta/'), {
      namespace: 'meta',
      queryToken: null,
    });
  });

  it('null pour les URLs hors prefix', () => {
    assert.equal(parseWebSocketUrl('/socket.io'), null);
    assert.equal(parseWebSocketUrl('/'), null);
    assert.equal(parseWebSocketUrl(undefined), null);
    // Namespace vide -> null
    assert.equal(parseWebSocketUrl('/api/v2/ws/'), null);
    // Namespace contenant un slash -> null
    assert.equal(parseWebSocketUrl('/api/v2/ws/foo/bar'), null);
  });
});

describe('ws/index — constantes', () => {
  it('WEBSOCKET_PROTOCOL_VERSION est semver', () => {
    assert.match(WEBSOCKET_PROTOCOL_VERSION, /^\d+\.\d+\.\d+$/);
  });

  it('WEBSOCKET_V2_FLAG vaut FEATURE_V2_WEBSOCKET', () => {
    assert.equal(WEBSOCKET_V2_FLAG, 'FEATURE_V2_WEBSOCKET');
  });

  it('WEBSOCKET_KNOWN_NAMESPACES contient meta, messaging, display et est frozen', () => {
    assert.ok(Object.isFrozen(WEBSOCKET_KNOWN_NAMESPACES));
    for (const ns of ['meta', 'messaging', 'display']) {
      assert.ok(WEBSOCKET_KNOWN_NAMESPACES.includes(ns), `contient ${ns}`);
    }
  });

  it('WEBSOCKET_URL_PREFIX termine par /', () => {
    assert.equal(WEBSOCKET_URL_PREFIX, '/api/v2/ws/');
  });
});

describe('ws/namespaces/meta — constantes + handleMetaMessage', () => {
  it('META_WS_PROTOCOL_VERSION semver + META_NAMESPACE_NAME = "meta"', () => {
    assert.match(META_WS_PROTOCOL_VERSION, /^\d+\.\d+\.\d+$/);
    assert.equal(META_NAMESPACE_NAME, 'meta');
    assert.equal(typeof DEFAULT_HEARTBEAT_INTERVAL_MS, 'number');
    assert.ok(DEFAULT_HEARTBEAT_INTERVAL_MS > 0);
  });

  it('ping -> pong (ts ISO)', () => {
    const reply = handleMetaMessage(JSON.stringify({ type: 'ping' }));
    assert.equal(reply.type, 'pong');
    assert.match(reply.ts, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  it("whoami renvoie l'utilisateur", () => {
    const reply = handleMetaMessage(JSON.stringify({ type: 'whoami' }), {
      user: { id: 42, email: 'a@b' },
    });
    assert.deepEqual(reply, { type: 'whoami', user: { id: 42, email: 'a@b' } });
  });

  it('whoami sans ctx.user -> user:null', () => {
    const reply = handleMetaMessage(JSON.stringify({ type: 'whoami' }));
    assert.deepEqual(reply, { type: 'whoami', user: null });
  });

  it('JSON invalide -> error INVALID_JSON', () => {
    const reply = handleMetaMessage('{not json');
    assert.deepEqual(reply, { type: 'error', code: 'INVALID_JSON' });
  });

  it('type inconnu -> error UNKNOWN_TYPE (echo type recu)', () => {
    const reply = handleMetaMessage(JSON.stringify({ type: 'foobar' }));
    assert.deepEqual(reply, { type: 'error', code: 'UNKNOWN_TYPE', received_type: 'foobar' });
  });

  it('message non objet -> error INVALID_MESSAGE', () => {
    const reply = handleMetaMessage(JSON.stringify(42));
    assert.deepEqual(reply, { type: 'error', code: 'INVALID_MESSAGE' });
  });
});

describe('ws/namespaces/meta — buildHeartbeatPayload', () => {
  it('renvoie la structure attendue', () => {
    const p = buildHeartbeatPayload({ uptimeMs: 1234, namespaceClientCounts: { meta: 3 } });
    assert.equal(p.type, 'heartbeat');
    assert.equal(p.namespace, 'meta');
    assert.equal(p.protocol_version, META_WS_PROTOCOL_VERSION);
    assert.equal(p.uptime_ms, 1234);
    assert.deepEqual(p.namespace_client_counts, { meta: 3 });
    assert.match(p.ts, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  it('valeurs par defaut safe', () => {
    const p = buildHeartbeatPayload({});
    assert.equal(p.uptime_ms, null);
    assert.deepEqual(p.namespace_client_counts, {});
  });
});
