#!/usr/bin/env node
/**
 * smoke-boot.mjs — Vérifie que le backend démarre, répond /api/health,
 * puis s'arrête proprement. Utilisé en CI comme garde-fou anti-corruption.
 *
 * - Démarre apps/api/server.js avec NODE_ENV=test sur PORT=4499
 * - Ping /api/health avec timeout 30s
 * - Kill le process et exit 0/1
 */
import { spawn } from 'node:child_process';
import { setTimeout as wait } from 'node:timers/promises';

const PORT = process.env.SMOKE_PORT || '4499';
const HOST = `http://127.0.0.1:${PORT}`;
const TIMEOUT_MS = 30_000;

console.log(`🚀 Boot backend sur port ${PORT}…`);

const child = spawn(process.execPath, ['server.js', '--dev'], {
  cwd: 'apps/api',
  env: {
    ...process.env,
    NODE_ENV: process.env.NODE_ENV || 'test',
    PORT,
    JWT_SECRET: process.env.JWT_SECRET || 'smoke-test-secret-key-min-32-chars-long-xx',
    DISABLE_SCHEDULER: '1',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});

let bootOutput = '';
child.stdout.on('data', (d) => {
  bootOutput += d.toString();
});
child.stderr.on('data', (d) => {
  bootOutput += d.toString();
});

let earlyExitCode = null;
child.on('exit', (code) => {
  earlyExitCode = code;
});

// Boucle de polling /api/health
const start = Date.now();
let ok = false;
while (Date.now() - start < TIMEOUT_MS) {
  if (earlyExitCode !== null) {
    console.error(`❌ Backend a quitté prématurément (code ${earlyExitCode})`);
    console.error('--- Sortie ---');
    console.error(bootOutput.slice(-2000));
    process.exit(1);
  }
  try {
    const res = await fetch(`${HOST}/api/health`);
    if (res.ok) {
      const body = await res.text();
      console.log(`✅ /api/health → ${res.status}`);
      console.log(`   ${body.slice(0, 200)}`);
      ok = true;
      break;
    }
  } catch {
    // pas encore prêt
  }
  await wait(500);
}

// Cleanup
child.kill('SIGTERM');
await wait(500);
if (!child.killed) child.kill('SIGKILL');

if (!ok) {
  console.error(`❌ Timeout : /api/health n'a pas répondu en ${TIMEOUT_MS}ms`);
  console.error('--- Sortie backend ---');
  console.error(bootOutput.slice(-2000));
  process.exit(1);
}

console.log('✅ Smoke boot OK');
process.exit(0);
