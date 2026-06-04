// Middleware de logging HTTP structuré
// Loggue method, path, status, duration pour chaque requête.
// Tient un ring buffer en mémoire des requêtes lentes pour analyse à chaud
// via /api/_perf/slow-requests (admin).
import logger from '../logger.js';

const SLOW_THRESHOLD_MS = Number(process.env.SLOW_REQUEST_THRESHOLD_MS) || 200;
const RING_SIZE = Number(process.env.SLOW_REQUEST_RING_SIZE) || 500;

// Ring buffer in-memory (non persistant — survit pas aux restarts).
const slowRing = [];

function normalizePath(url) {
  const path = url.split('?')[0];
  return path
    .split('/')
    .map((seg) => {
      if (/^\d+$/.test(seg)) return ':id';
      // Hash-like (24+ hex chars) ou UUID
      if (/^[0-9a-f-]{24,}$/i.test(seg)) return ':id';
      return seg;
    })
    .join('/');
}

export function getSlowRequests({ limit = 100, minDuration = 0 } = {}) {
  const filtered = slowRing.filter((e) => e.duration >= minDuration);
  const start = Math.max(0, filtered.length - limit);
  return filtered.slice(start).reverse();
}

export function getSlowRequestsAggregated() {
  const map = new Map();
  for (const e of slowRing) {
    const key = `${e.method} ${normalizePath(e.url)}`;
    const cur = map.get(key) || {
      route: key,
      count: 0,
      totalMs: 0,
      maxMs: 0,
      lastSeen: e.ts,
    };
    cur.count += 1;
    cur.totalMs += e.duration;
    cur.maxMs = Math.max(cur.maxMs, e.duration);
    cur.lastSeen = e.ts;
    map.set(key, cur);
  }
  return [...map.values()]
    .map((r) => ({ ...r, avgMs: Math.round(r.totalMs / r.count) }))
    .sort((a, b) => b.totalMs - a.totalMs);
}

export function getSlowRequestStats() {
  return {
    thresholdMs: SLOW_THRESHOLD_MS,
    ringSize: RING_SIZE,
    bufferedCount: slowRing.length,
    oldestTs: slowRing[0]?.ts || null,
    newestTs: slowRing[slowRing.length - 1]?.ts || null,
  };
}

export function httpLogger(req, res, next) {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    const status = res.statusCode;
    const method = req.method;
    const url = req.originalUrl;

    // Skip les health checks et assets statiques pour éviter le bruit
    if (url === '/api/health' || url.startsWith('/assets/') || url.startsWith('/icons/')) {
      return;
    }

    const isSlow = duration >= SLOW_THRESHOLD_MS;

    if (status >= 500) {
      logger.error(`${method} ${url} ${status} ${duration}ms`);
    } else if (status >= 400) {
      logger.warn(`${method} ${url} ${status} ${duration}ms`);
    } else if (isSlow) {
      logger.warn(`SLOW ${method} ${url} ${status} ${duration}ms`);
    } else {
      logger.debug(`${method} ${url} ${status} ${duration}ms`);
    }

    if (isSlow) {
      slowRing.push({
        ts: new Date().toISOString(),
        method,
        url,
        status,
        duration,
        ip: req.ip,
        userId: req.user?.id || null,
      });
      if (slowRing.length > RING_SIZE) slowRing.shift();
    }
  });

  next();
}
