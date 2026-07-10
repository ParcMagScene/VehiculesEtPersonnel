#!/usr/bin/env node
/**
 * Tests e2e — serveur WebSocket + auth + namespace meta (T-P1-02).
 *
 * Utilise un serveur HTTP local + un client `ws` pour valider
 * l'ensemble du cycle : upgrade, gate flag, auth, welcome,
 * ping/pong, whoami, close.
 */

import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { createServer } from 'node:http';
import { after, before, describe, it } from 'node:test';

import Database from 'better-sqlite3';
import jwt from 'jsonwebtoken';
import WebSocket from 'ws';

import { attachWebSocketServer, WEBSOCKET_V2_FLAG } from '../../../apps/api/ws/index.js';

const JWT_SECRET = 'test-secret-'.padEnd(48, 'x');
const USER_ID = 42;

function makeDb() {
  const db = new Database(':memory:');
  db.exec(`CREATE TABLE active_sessions (
    token_hash TEXT PRIMARY KEY,
    expires_at DATETIME NOT NULL
  )`);
  return db;
}

function issueToken(db, { expired = false } = {}) {
  const token = jwt.sign({ id: USER_ID, email: 'test@e.mag' }, JWT_SECRET, {
    algorithm: 'HS256',
    expiresIn: '1h',
  });
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex').substring(0, 64);
  const expiresAt = expired ? "datetime('now', '-1 hour')" : "datetime('now', '+1 hour')";
  db.prepare(`INSERT INTO active_sessions (token_hash, expires_at) VALUES (?, ${expiresAt})`).run(
    tokenHash,
  );
  return { token, tokenHash };
}

function nextMessage(ws) {
  return new Promise((resolve, reject) => {
    const onMsg = (buf) => {
      cleanup();
      try {
        resolve(JSON.parse(buf.toString()));
      } catch (err) {
        reject(err);
      }
    };
    const onErr = (err) => {
      cleanup();
      reject(err);
    };
    const onClose = (code, reason) => {
      cleanup();
      reject(new Error(`socket closed unexpectedly (code=${code}, reason=${reason})`));
    };
    function cleanup() {
      ws.off('message', onMsg);
      ws.off('error', onErr);
      ws.off('close', onClose);
    }
    ws.on('message', onMsg);
    ws.on('error', onErr);
    ws.on('close', onClose);
  });
}

async function waitClose(ws) {
  return new Promise((resolve) => {
    if (ws.readyState === WebSocket.CLOSED) {
      resolve({ code: 1000, reason: 'already-closed' });
      return;
    }
    ws.once('close', (code, reason) => resolve({ code, reason: reason?.toString?.('utf8') ?? '' }));
    ws.once('error', () => resolve({ code: -1, reason: 'error' }));
  });
}

function bootServer(db, { flagOn = true } = {}) {
  if (flagOn) process.env[WEBSOCKET_V2_FLAG] = '1';
  else delete process.env[WEBSOCKET_V2_FLAG];
  const httpServer = createServer((req, res) => {
    res.writeHead(200);
    res.end('ok');
  });
  const wsCore = attachWebSocketServer(httpServer, {
    jwtSecret: JWT_SECRET,
    db,
    // Coupe le heartbeat pour laisser le test controler.
    heartbeatIntervalMs: 0,
  });
  return new Promise((resolve) => {
    httpServer.listen(0, () => resolve({ httpServer, wsCore, port: httpServer.address().port }));
  });
}

let flagBackup;

before(() => {
  flagBackup = process.env[WEBSOCKET_V2_FLAG];
});

after(() => {
  if (flagBackup === undefined) delete process.env[WEBSOCKET_V2_FLAG];
  else process.env[WEBSOCKET_V2_FLAG] = flagBackup;
});

describe('ws e2e — feature flag off (T-P1-02)', () => {
  it('flag off -> upgrade refuse (client recoit un close/error)', async () => {
    const db = makeDb();
    const { httpServer, wsCore, port } = await bootServer(db, { flagOn: false });
    try {
      const { token } = issueToken(db);
      const ws = new WebSocket(`ws://127.0.0.1:${port}/api/v2/ws/meta?token=${token}`);
      const result = await waitClose(ws);
      assert.ok(result.code !== 1000, `refus attendu quand flag off (code=${result.code})`);
    } finally {
      await wsCore.close();
      httpServer.close();
      db.close();
    }
  });
});

describe('ws e2e — namespace meta (T-P1-02)', () => {
  it('auth OK -> welcome + ping/pong + whoami', async () => {
    const db = makeDb();
    const { httpServer, wsCore, port } = await bootServer(db, { flagOn: true });
    try {
      const { token } = issueToken(db);
      const ws = new WebSocket(`ws://127.0.0.1:${port}/api/v2/ws/meta?token=${token}`);
      // 1. Welcome
      const welcome = await nextMessage(ws);
      assert.equal(welcome.type, 'welcome');
      assert.equal(welcome.namespace, 'meta');
      assert.equal(welcome.user.id, USER_ID);
      // 2. Ping / pong
      ws.send(JSON.stringify({ type: 'ping' }));
      const pong = await nextMessage(ws);
      assert.equal(pong.type, 'pong');
      // 3. Whoami
      ws.send(JSON.stringify({ type: 'whoami' }));
      const whoami = await nextMessage(ws);
      assert.equal(whoami.type, 'whoami');
      assert.equal(whoami.user.id, USER_ID);
      // 4. Client counts
      const counts = wsCore.clientsByNamespace();
      assert.equal(counts.meta, 1);
      ws.close();
      await waitClose(ws);
    } finally {
      await wsCore.close();
      httpServer.close();
      db.close();
    }
  });

  it('token invalide -> connexion refusee (401)', async () => {
    const db = makeDb();
    const { httpServer, wsCore, port } = await bootServer(db, { flagOn: true });
    try {
      const ws = new WebSocket(`ws://127.0.0.1:${port}/api/v2/ws/meta?token=totally-invalid`);
      const result = await waitClose(ws);
      assert.notEqual(result.code, 1000);
    } finally {
      await wsCore.close();
      httpServer.close();
      db.close();
    }
  });

  it('token valide JWT mais session absente en DB -> refuse', async () => {
    const db = makeDb();
    const { httpServer, wsCore, port } = await bootServer(db, { flagOn: true });
    try {
      // Token signe mais on ne l'insert PAS dans active_sessions.
      const token = jwt.sign({ id: USER_ID }, JWT_SECRET, {
        algorithm: 'HS256',
        expiresIn: '1h',
      });
      const ws = new WebSocket(`ws://127.0.0.1:${port}/api/v2/ws/meta?token=${token}`);
      const result = await waitClose(ws);
      assert.notEqual(result.code, 1000);
    } finally {
      await wsCore.close();
      httpServer.close();
      db.close();
    }
  });

  it('namespace inconnu -> refuse 404', async () => {
    const db = makeDb();
    const { httpServer, wsCore, port } = await bootServer(db, { flagOn: true });
    try {
      const { token } = issueToken(db);
      const ws = new WebSocket(`ws://127.0.0.1:${port}/api/v2/ws/inexistant?token=${token}`);
      const result = await waitClose(ws);
      assert.notEqual(result.code, 1000);
    } finally {
      await wsCore.close();
      httpServer.close();
      db.close();
    }
  });

  it('namespace declare mais pas encore livre (messaging) -> NAMESPACE_NOT_READY', async () => {
    const db = makeDb();
    const { httpServer, wsCore, port } = await bootServer(db, { flagOn: true });
    try {
      const { token } = issueToken(db);
      const ws = new WebSocket(`ws://127.0.0.1:${port}/api/v2/ws/messaging?token=${token}`);
      const msg = await nextMessage(ws);
      assert.equal(msg.type, 'error');
      assert.equal(msg.code, 'NAMESPACE_NOT_READY');
      await waitClose(ws);
    } finally {
      await wsCore.close();
      httpServer.close();
      db.close();
    }
  });
});
