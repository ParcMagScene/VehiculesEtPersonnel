// [PERF Phase 4.N] Slow log SQL au niveau requête.
// Patche `db.prepare()` pour wrapper chaque Statement et mesurer la durée
// de `.run()`, `.get()`, `.all()`. Tient un ring buffer + un agrégat par SQL.
//
// Coût overhead ~quelques µs/requête (process.hrtime.bigint + Map ops).
// Désactivable via ENABLE_SQL_SLOW_LOG=0. Configurable via SLOW_SQL_THRESHOLD_MS.
//
// Exposé via /api/_perf/slow-sql et /api/_perf/slow-sql/aggregated (admin).
import logger from '../logger.js';

const ENABLED = process.env.ENABLE_SQL_SLOW_LOG !== '0';
const THRESHOLD_MS = Number(process.env.SLOW_SQL_THRESHOLD_MS) || 50;
const RING_SIZE = Number(process.env.SLOW_SQL_RING_SIZE) || 500;
const MAX_SQL_LEN = 400; // tronque les SQL très longs dans le ring/agrégat

const ring = [];
// sql_key (tronqué) -> { sql, count, totalMs, maxMs, slowCount, lastSeen }
const aggregate = new Map();

function truncSql(sql) {
  if (!sql) return '<unknown>';
  const oneLine = sql.replace(/\s+/g, ' ').trim();
  return oneLine.length > MAX_SQL_LEN ? oneLine.slice(0, MAX_SQL_LEN) + '…' : oneLine;
}

function record(sql, method, durationMs) {
  const key = truncSql(sql);
  // Ring buffer : on garde TOUTES les lentes (>= seuil)
  if (durationMs >= THRESHOLD_MS) {
    ring.push({ sql: key, method, durationMs, ts: Date.now() });
    if (ring.length > RING_SIZE) ring.shift();
  }
  // Agrégat : on compte TOUS les appels pour avoir le ratio slow/total
  const cur = aggregate.get(key) || {
    sql: key,
    count: 0,
    totalMs: 0,
    maxMs: 0,
    slowCount: 0,
    lastSeen: 0,
  };
  cur.count++;
  cur.totalMs += durationMs;
  cur.maxMs = Math.max(cur.maxMs, durationMs);
  if (durationMs >= THRESHOLD_MS) cur.slowCount++;
  cur.lastSeen = Date.now();
  aggregate.set(key, cur);
}

export function instrumentDb(db) {
  if (!ENABLED) {
    logger.info('🔇 SQL slow log: désactivé (ENABLE_SQL_SLOW_LOG=0)');
    return db;
  }
  const originalPrepare = db.prepare.bind(db);
  db.prepare = function patchedPrepare(sql) {
    const stmt = originalPrepare(sql);
    const src = stmt.source || sql;
    for (const method of ['run', 'get', 'all']) {
      // certaines variantes (pluck/raw/expand) renvoient un nouveau Statement —
      // on patch uniquement les 3 méthodes terminales standards.
      const orig = stmt[method];
      if (typeof orig !== 'function') continue;
      const bound = orig.bind(stmt);
      stmt[method] = function instrumented(...args) {
        const start = process.hrtime.bigint();
        try {
          return bound(...args);
        } finally {
          const ms = Number(process.hrtime.bigint() - start) / 1e6;
          record(src, method, ms);
        }
      };
    }
    return stmt;
  };
  logger.info(`📊 SQL slow log: actif (seuil ${THRESHOLD_MS}ms, ring ${RING_SIZE})`);
  return db;
}

export function getSlowSqlEntries({ limit = 100, minDuration = 0 } = {}) {
  const filtered = ring.filter((e) => e.durationMs >= minDuration);
  const start = Math.max(0, filtered.length - limit);
  return filtered.slice(start).reverse();
}

export function getSlowSqlAggregated({ limit = 50, sortBy = 'totalMs' } = {}) {
  const items = [...aggregate.values()].map((r) => ({
    ...r,
    avgMs: r.count > 0 ? r.totalMs / r.count : 0,
  }));
  const cmp =
    sortBy === 'maxMs'
      ? (a, b) => b.maxMs - a.maxMs
      : sortBy === 'avgMs'
        ? (a, b) => b.avgMs - a.avgMs
        : sortBy === 'slowCount'
          ? (a, b) => b.slowCount - a.slowCount
          : (a, b) => b.totalMs - a.totalMs;
  return items.sort(cmp).slice(0, limit);
}

export function getSqlSlowLogStats() {
  return {
    enabled: ENABLED,
    thresholdMs: THRESHOLD_MS,
    ringSize: RING_SIZE,
    bufferedSlow: ring.length,
    distinctQueries: aggregate.size,
    oldestTs: ring[0]?.ts || null,
    newestTs: ring[ring.length - 1]?.ts || null,
  };
}
