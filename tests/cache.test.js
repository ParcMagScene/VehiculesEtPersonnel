/**
 * tests/cache.test.js — [S2-3] Tests du cache LRU/TTL et middleware Express
 *
 * Couvre :
 *  - get/set/has/expiration/éviction LRU
 *  - invalidate / invalidatePattern / clear
 *  - cacheMiddleware (HIT/MISS/skip non-GET/no-cache/keyFn null)
 *  - invalidateOnSuccess (vide caches après réponse 2xx, conserve sur 4xx/5xx)
 *  - getAllCacheStats inclut les nouveaux caches S2-3
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ALL_CACHES,
  annuaireRefCache,
  cacheMiddleware,
  equipmentListCache,
  equipmentTreeCache,
  getAllCacheStats,
  invalidateOnSuccess,
  LRUCache,
  personnelPlanningCache,
  suiviPersonnelCache,
} from '../apps/api/cache.js';

// ─── Helpers : faux req/res Express ───
function makeReq({ method = 'GET', headers = {}, query = {} } = {}) {
  return { method, headers, query };
}
function makeRes() {
  const res = {
    statusCode: 200,
    _json: undefined,
    _headers: {},
    set(k, v) {
      this._headers[k] = v;
      return this;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this._json = data;
      return this;
    },
  };
  return res;
}

// ─── LRUCache de base ───

test('LRUCache : get retourne null si absent', () => {
  const c = new LRUCache({ name: 't1' });
  assert.equal(c.get('x'), null);
});

test('LRUCache : set/get/has', () => {
  const c = new LRUCache({ name: 't2' });
  c.set('a', 42);
  assert.equal(c.get('a'), 42);
  assert.equal(c.has('a'), true);
  assert.equal(c.has('b'), false);
});

test('LRUCache : expiration TTL', async () => {
  const c = new LRUCache({ name: 't3', ttl: 20 });
  c.set('k', 'v');
  await new Promise((r) => setTimeout(r, 30));
  assert.equal(c.get('k'), null);
  assert.equal(c.has('k'), false);
});

test('LRUCache : éviction LRU au-delà de maxSize', () => {
  const c = new LRUCache({ name: 't4', maxSize: 2 });
  c.set('a', 1);
  c.set('b', 2);
  c.set('c', 3); // évince 'a'
  assert.equal(c.get('a'), null);
  assert.equal(c.get('b'), 2);
  assert.equal(c.get('c'), 3);
});

test('LRUCache : invalidate / invalidatePattern / clear', () => {
  const c = new LRUCache({ name: 't5' });
  c.set('user:1', 1);
  c.set('user:2', 2);
  c.set('post:1', 9);
  c.invalidate('user:1');
  assert.equal(c.get('user:1'), null);
  c.invalidatePattern(/^user:/);
  assert.equal(c.get('user:2'), null);
  assert.equal(c.get('post:1'), 9);
  c.clear();
  assert.equal(c.get('post:1'), null);
});

test('LRUCache : stats hits/misses/hitRate', () => {
  const c = new LRUCache({ name: 't6' });
  c.set('k', 1);
  c.get('k'); // hit
  c.get('k'); // hit
  c.get('z'); // miss
  const s = c.stats();
  assert.equal(s.hits, 2);
  assert.equal(s.misses, 1);
  assert.equal(s.size, 1);
  assert.equal(s.hitRate, '66.7%');
});

// ─── cacheMiddleware ───

test('cacheMiddleware : MISS puis HIT, header X-Cache', () => {
  const c = new LRUCache({ name: 'mw1' });
  const mw = cacheMiddleware(c, () => 'k');

  // 1er appel → MISS, exécute next, capture res.json
  const req1 = makeReq();
  const res1 = makeRes();
  let nextCalled = false;
  mw(req1, res1, () => {
    nextCalled = true;
  });
  assert.equal(nextCalled, true);
  assert.equal(res1._headers['X-Cache'], 'MISS');
  res1.json({ ok: true });
  assert.deepEqual(c.get('k'), { ok: true });

  // 2e appel → HIT, ne passe pas par next
  const req2 = makeReq();
  const res2 = makeRes();
  let next2 = false;
  mw(req2, res2, () => {
    next2 = true;
  });
  assert.equal(next2, false);
  assert.equal(res2._headers['X-Cache'], 'HIT');
  assert.deepEqual(res2._json, { ok: true });
});

test('cacheMiddleware : ne cache pas les statusCode >= 300', () => {
  const c = new LRUCache({ name: 'mw2' });
  const mw = cacheMiddleware(c, () => 'k');
  const res = makeRes();
  mw(makeReq(), res, () => {});
  res.status(500).json({ error: 'boom' });
  assert.equal(c.get('k'), null);
});

test('cacheMiddleware : bypass si méthode != GET', () => {
  const c = new LRUCache({ name: 'mw3' });
  const mw = cacheMiddleware(c, () => 'k');
  const res = makeRes();
  let called = false;
  mw(makeReq({ method: 'POST' }), res, () => {
    called = true;
  });
  assert.equal(called, true);
  assert.equal(res._headers['X-Cache'], undefined);
});

test('cacheMiddleware : bypass si Cache-Control: no-cache', () => {
  const c = new LRUCache({ name: 'mw4' });
  const mw = cacheMiddleware(c, () => 'k');
  c.set('k', { cached: true });
  const res = makeRes();
  let called = false;
  mw(makeReq({ headers: { 'cache-control': 'no-cache' } }), res, () => {
    called = true;
  });
  assert.equal(called, true);
  assert.equal(res._json, undefined);
});

test('cacheMiddleware : bypass si keyFn retourne null', () => {
  const c = new LRUCache({ name: 'mw5' });
  const mw = cacheMiddleware(c, () => null);
  const res = makeRes();
  let called = false;
  mw(makeReq(), res, () => {
    called = true;
  });
  assert.equal(called, true);
  assert.equal(res._headers['X-Cache'], undefined);
});

// ─── invalidateOnSuccess ───

test('invalidateOnSuccess : clear sur 2xx', () => {
  const c = new LRUCache({ name: 'inv1' });
  c.set('a', 1);
  c.set('b', 2);
  const mw = invalidateOnSuccess(c);
  const res = makeRes();
  mw(makeReq({ method: 'POST' }), res, () => {});
  res.status(200).json({ ok: true });
  assert.equal(c.get('a'), null);
  assert.equal(c.get('b'), null);
});

test('invalidateOnSuccess : ne clear PAS sur 4xx/5xx', () => {
  const c = new LRUCache({ name: 'inv2' });
  c.set('a', 1);
  const mw = invalidateOnSuccess(c);
  const res = makeRes();
  mw(makeReq({ method: 'POST' }), res, () => {});
  res.status(400).json({ error: 'bad' });
  assert.equal(c.get('a'), 1);
});

test('invalidateOnSuccess : multi-caches', () => {
  const c1 = new LRUCache({ name: 'inv3a' });
  const c2 = new LRUCache({ name: 'inv3b' });
  c1.set('x', 1);
  c2.set('y', 2);
  const mw = invalidateOnSuccess(c1, c2);
  const res = makeRes();
  mw(makeReq({ method: 'DELETE' }), res, () => {});
  res.status(204).json({});
  assert.equal(c1.get('x'), null);
  assert.equal(c2.get('y'), null);
});

// ─── Registre global ───

test('ALL_CACHES contient les nouveaux caches S2-3', () => {
  for (const c of [
    equipmentTreeCache,
    equipmentListCache,
    annuaireRefCache,
    personnelPlanningCache,
    suiviPersonnelCache,
  ]) {
    assert.ok(ALL_CACHES.includes(c), `${c.name} doit être enregistré`);
  }
  const stats = getAllCacheStats();
  const names = stats.map((s) => s.name);
  assert.ok(names.includes('equipment-tree'));
  assert.ok(names.includes('personnel-planning'));
});
