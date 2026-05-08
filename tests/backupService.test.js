// Tests du service backups (lecture seule).
// Vérifie listBackups/getStatus/readManifest sans toucher aux vrais fichiers.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

test('backupService - structure exports', async () => {
  const mod = await import('../apps/api/services/backupService.js');
  assert.equal(typeof mod.listBackups, 'function');
  assert.equal(typeof mod.readManifest, 'function');
  assert.equal(typeof mod.getRecentLog, 'function');
  assert.equal(typeof mod.getStatus, 'function');
});

test('backupService - getStatus tolère absence de fichiers', async () => {
  // On lance dans un répertoire temporaire vide pour vérifier la robustesse.
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'backupsvc-'));
  const cwdBefore = process.cwd();
  try {
    process.chdir(tmp);
    // Force un fresh import via cache-buster (lecture du module ESM).
    const url = `../apps/api/services/backupService.js?cb=${Date.now()}`;
    const mod = await import(url);
    const status = mod.getStatus();
    assert.equal(typeof status, 'object');
    assert.equal(status.dbCount, 0);
    assert.equal(status.mediaCount, 0);
    assert.equal(status.lastDbBackup, null);
  } finally {
    process.chdir(cwdBefore);
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('backupService - listBackups renvoie tableaux triés desc', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'backupsvc-'));
  const cwdBefore = process.cwd();
  try {
    process.chdir(tmp);
    fs.mkdirSync(path.join(tmp, 'backups', 'db', '2026', '05'), { recursive: true });
    const f1 = path.join(tmp, 'backups', 'db', '2026', '05', 'prod-20260501-020000.db.gz');
    const f2 = path.join(tmp, 'backups', 'db', '2026', '05', 'prod-20260507-020000.db.gz');
    fs.writeFileSync(f1, 'a');
    fs.writeFileSync(f2, 'b');
    // Forcer mtimes distinctes pour test du tri.
    const past = new Date('2026-05-01T02:00:00Z');
    const recent = new Date('2026-05-07T02:00:00Z');
    fs.utimesSync(f1, past, past);
    fs.utimesSync(f2, recent, recent);

    const url = `../apps/api/services/backupService.js?cb=${Date.now()}`;
    const mod = await import(url);
    const { db } = mod.listBackups();
    assert.equal(db.length, 2);
    assert.ok(db[0].path.includes('20260507'));
  } finally {
    process.chdir(cwdBefore);
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
