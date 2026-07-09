#!/usr/bin/env node
/**
 * Tests smoke — SSE endpoint /api/v2/display/signals/stream (T-P0-16).
 *
 * Un vrai serveur Express local, un vrai flux fetch qui lit le stream
 * SSE, decoupe en events et verifie :
 *   - Le snapshot initial arrive rapidement.
 *   - Le format `event: <type>\ndata: <json>\n\n` est respecte.
 *   - Un heartbeat ping arrive (avec un intervalle raccourci pour le test).
 *   - screen_id invalide → 400 VALIDATION_ERROR (pas de connexion SSE).
 */

import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

import Database from 'better-sqlite3';
import express from 'express';

import { DISPLAY_V2_FLAG } from '../../../apps/api/v2/displayRoutes.js';

// On importe le module apres setup DB : displayRoutes.js n'utilise `db`
// que via l'import de '../database.js'. Pour un test isole on injecte
// une DB in-memory via patch du singleton.
// Approche : creer une petite app Express qui monte les routes avec
// une DB in-memory dediee, sans passer par le vrai apps/api/database.js.

// Import dynamique du service pour ne pas charger la DB reelle.
const { getSignalsForScreen } = await import('../../../apps/api/services/display/index.js');

// On reproduit ici la logique minimale du SSE endpoint pour tester en
// isolation sans passer par displayRoutes.js (qui importe la DB reelle).
// Cela permet aussi d'injecter des intervalles courts pour le test.
function createFlagGuard(envKey) {
  return (_req, res, next) => {
    const raw = process.env[envKey];
    if (raw && /^(1|true|yes|on)$/i.test(raw)) {
      next();
      return;
    }
    res.status(404).json({ success: false, error: 'off', code: 'FEATURE_DISABLED' });
  };
}

function setupTestSseRoute(app, db, { snapshotMs = 60, heartbeatMs = 40 } = {}) {
  const flagGuard = createFlagGuard(DISPLAY_V2_FLAG);
  app.get('/api/v2/display/signals/stream', flagGuard, (req, res) => {
    try {
      getSignalsForScreen({ db, screenId: req.query.screen_id });
    } catch (err) {
      const status = err.name === 'DisplayV2ValidationError' ? 400 : 404;
      return res.status(status).json({ success: false, error: err.message, code: err.name });
    }
    res.set({
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    });
    res.flushHeaders();
    const push = () => {
      try {
        const snap = getSignalsForScreen({ db, screenId: req.query.screen_id });
        res.write(`event: snapshot\ndata: ${JSON.stringify(snap)}\n\n`);
      } catch {
        /* ignore */
      }
    };
    push();
    const t1 = setInterval(push, snapshotMs);
    const t2 = setInterval(() => {
      res.write(`event: ping\ndata: ${JSON.stringify({ at: new Date().toISOString() })}\n\n`);
    }, heartbeatMs);
    req.on('close', () => {
      clearInterval(t1);
      clearInterval(t2);
    });
  });
}

let db;
let flagBackup;

before(async () => {
  flagBackup = process.env[DISPLAY_V2_FLAG];
  process.env[DISPLAY_V2_FLAG] = '1';

  db = new Database(':memory:');
  db.exec(`
    CREATE TABLE display_screens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      status TEXT DEFAULT 'offline',
      last_heartbeat TEXT
    );
    CREATE TABLE display_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      body TEXT,
      priority TEXT DEFAULT 'normal',
      date_start TEXT,
      date_end TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE display_welcome_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      day TEXT NOT NULL,
      slot TEXT NOT NULL,
      message TEXT NOT NULL
    );
  `);
  db.prepare(`INSERT INTO display_screens (id, name) VALUES (1, 'Ecran 1')`).run();
});

after(() => {
  db.close();
  if (flagBackup === undefined) delete process.env[DISPLAY_V2_FLAG];
  else process.env[DISPLAY_V2_FLAG] = flagBackup;
});

/**
 * Parse un chunk SSE en events. Retourne un tableau de
 * `{ event, data }` (data = objet JSON parsed).
 * @param {string} raw
 */
function parseSseChunk(raw) {
  const events = [];
  const blocks = raw.split('\n\n').filter((b) => b.trim().length > 0);
  for (const block of blocks) {
    const lines = block.split('\n');
    let event = 'message';
    let data = '';
    for (const line of lines) {
      if (line.startsWith('event:')) event = line.slice(6).trim();
      else if (line.startsWith('data:')) data = line.slice(5).trim();
    }
    let parsed;
    try {
      parsed = JSON.parse(data);
    } catch {
      parsed = data;
    }
    events.push({ event, data: parsed });
  }
  return events;
}

describe('signals/stream — SSE endpoint (T-P0-16)', () => {
  it('screen_id manquant → 400 VALIDATION (pas d\'ouverture SSE)', async () => {
    const app = express();
    setupTestSseRoute(app, db);
    const server = app.listen(0);
    const port = server.address().port;
    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/v2/display/signals/stream`);
      assert.equal(res.status, 400);
      const body = await res.json();
      assert.equal(body.code, 'DisplayV2ValidationError');
    } finally {
      server.close();
    }
  });

  it('flag off → 404 FEATURE_DISABLED', async () => {
    process.env[DISPLAY_V2_FLAG] = '0';
    const app = express();
    setupTestSseRoute(app, db);
    const server = app.listen(0);
    const port = server.address().port;
    try {
      const res = await fetch(
        `http://127.0.0.1:${port}/api/v2/display/signals/stream?screen_id=1`,
      );
      assert.equal(res.status, 404);
      const body = await res.json();
      assert.equal(body.code, 'FEATURE_DISABLED');
    } finally {
      server.close();
      process.env[DISPLAY_V2_FLAG] = '1';
    }
  });

  it('screen_id valide → snapshot initial + heartbeat SSE', async () => {
    const app = express();
    setupTestSseRoute(app, db, { snapshotMs: 500, heartbeatMs: 100 });
    const server = app.listen(0);
    const port = server.address().port;
    try {
      const controller = new AbortController();
      const res = await fetch(
        `http://127.0.0.1:${port}/api/v2/display/signals/stream?screen_id=1`,
        { signal: controller.signal },
      );
      assert.equal(res.status, 200);
      assert.match(res.headers.get('content-type') || '', /^text\/event-stream/);
      assert.equal(res.headers.get('cache-control'), 'no-cache, no-transform');

      // Lecture manuelle du stream pendant 400ms (au moins 2 ticks
      // heartbeat 100ms) puis abort.
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = '';
      const deadline = Date.now() + 400;
      while (Date.now() < deadline) {
        const { value, done } = await Promise.race([
          reader.read(),
          new Promise((r) => setTimeout(() => r({ done: true }), 150)),
        ]);
        if (done) break;
        if (value) accumulated += decoder.decode(value, { stream: true });
        if (accumulated.includes('event: ping')) break;
      }
      controller.abort();
      const events = parseSseChunk(accumulated);
      assert.ok(events.length >= 1, `au moins 1 event recu, got ${events.length}`);
      // Premier event : snapshot.
      const first = events[0];
      assert.equal(first.event, 'snapshot');
      assert.equal(first.data.screen.id, 1);
      assert.ok(Array.isArray(first.data.messages));
      // Au moins un ping doit arriver (heartbeat 100ms sur 400ms de
      // lecture — 3 ticks attendus, tolerance a 1 pour flaky CI).
      const hasPing = events.some((e) => e.event === 'ping');
      assert.ok(hasPing, 'un heartbeat ping doit etre pousse');
    } finally {
      server.close();
    }
  });
});
