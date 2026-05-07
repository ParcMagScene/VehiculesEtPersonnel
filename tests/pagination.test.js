/**
 * tests/pagination.test.js — [S2-2] Helper pagination opt-in
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildPaginatedPayload,
  DEFAULT_LIMIT,
  MAX_LIMIT,
  parsePagination,
  sendPaginated,
} from '../apps/api/utils/pagination.js';

function makeRes() {
  return {
    _json: undefined,
    json(d) {
      this._json = d;
      return this;
    },
  };
}

test('parsePagination : sans paramètre = legacy (paginated=false)', () => {
  const p = parsePagination({ query: {} });
  assert.equal(p.paginated, false);
  assert.equal(p.page, 1);
  assert.equal(p.limit, DEFAULT_LIMIT);
  assert.equal(p.offset, 0);
  assert.equal(p.sort, null);
});

test('parsePagination : avec page seul', () => {
  const p = parsePagination({ query: { page: '3' } });
  assert.equal(p.paginated, true);
  assert.equal(p.page, 3);
  assert.equal(p.limit, DEFAULT_LIMIT);
  assert.equal(p.offset, 200);
});

test('parsePagination : limit plafonné à MAX_LIMIT', () => {
  const p = parsePagination({ query: { limit: '99999' } });
  assert.equal(p.limit, MAX_LIMIT);
});

test('parsePagination : valeurs invalides → défauts', () => {
  const p = parsePagination({ query: { page: '-1', limit: 'abc' } });
  assert.equal(p.page, 1);
  assert.equal(p.limit, DEFAULT_LIMIT);
});

test('parsePagination : sort=col:desc', () => {
  const p = parsePagination({ query: { sort: 'name:desc' } });
  assert.deepEqual(p.sort, { column: 'name', dir: 'desc' });
});

test('parsePagination : sort sans dir → asc', () => {
  const p = parsePagination({ query: { sort: 'created_at' } });
  assert.deepEqual(p.sort, { column: 'created_at', dir: 'asc' });
});

test('parsePagination : sort avec colonne invalide (injection) → null', () => {
  const p = parsePagination({ query: { sort: 'name; DROP TABLE users--' } });
  assert.equal(p.sort, null);
});

test('buildPaginatedPayload : slice côté Node si total absent', () => {
  const items = Array.from({ length: 250 }, (_, i) => i);
  const p = parsePagination({ query: { page: '2', limit: '100' } });
  const out = buildPaginatedPayload(items, p);
  assert.equal(out.data.length, 100);
  assert.equal(out.data[0], 100);
  assert.equal(out.pagination.total, 250);
  assert.equal(out.pagination.totalPages, 3);
});

test('buildPaginatedPayload : pas de slice si total fourni (SQL déjà tronqué)', () => {
  const items = [1, 2, 3];
  const p = parsePagination({ query: { page: '2', limit: '3' } });
  const out = buildPaginatedPayload(items, p, { total: 100 });
  assert.deepEqual(out.data, [1, 2, 3]);
  assert.equal(out.pagination.total, 100);
  assert.equal(out.pagination.totalPages, 34);
});

test('sendPaginated : mode legacy renvoie le tableau brut', () => {
  const res = makeRes();
  const p = parsePagination({ query: {} });
  sendPaginated(res, [{ a: 1 }, { a: 2 }], p);
  assert.deepEqual(res._json, [{ a: 1 }, { a: 2 }]);
});

test('sendPaginated : mode paginé renvoie {data,pagination}', () => {
  const res = makeRes();
  const p = parsePagination({ query: { page: '1', limit: '1' } });
  sendPaginated(res, [{ a: 1 }, { a: 2 }], p);
  assert.equal(Array.isArray(res._json.data), true);
  assert.equal(res._json.data.length, 1);
  assert.equal(res._json.pagination.total, 2);
  assert.equal(res._json.pagination.totalPages, 2);
});
