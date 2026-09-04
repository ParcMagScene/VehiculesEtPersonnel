// Tests des repositories forfait-jours (entretiens, alertes, poses).
// Utilisent une DB SQLite in-memory pour ne pas polluer la vraie DB.
import Database from 'better-sqlite3';
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  countPosesByType,
  createAlert,
  createEntretien,
  createRestPose,
  getEntretienComplianceForYear,
  listAlerts,
  listEntretiens,
  listRestPoses,
  resolveAlert,
  updateEntretien,
} from '../apps/api/services/forfait/repository.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function makeDb() {
  const db = new Database(':memory:');
  // Tables minimales requises par les FK
  db.exec(`
    CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT);
    CREATE TABLE persons (
      id INTEGER PRIMARY KEY,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      type TEXT DEFAULT 'permanent',
      user_id INTEGER
    );
    INSERT INTO users (id, name) VALUES (1, 'admin');
    INSERT INTO persons (id, first_name, last_name) VALUES (10, 'Jean', 'Dupont');
  `);
  const sql = readFileSync(
    path.join(__dirname, '../apps/api/migrations/versioned/0016_forfait_couches_4_5.sql'),
    'utf8',
  );
  // Skip ALTER TABLE persons since not the full table
  const filtered = sql
    .split('\n')
    .filter((l) => !l.trim().startsWith('ALTER TABLE persons'))
    .join('\n');
  db.exec(filtered);
  return db;
}

// ─── Entretiens ─────────────────────────────────────────────
test('createEntretien + listEntretiens', () => {
  const db = makeDb();
  const e = createEntretien(
    db,
    {
      personId: 10,
      year: 2026,
      type: 'annuel',
      scheduledDate: '2026-06-15',
      heldDate: '2026-06-15',
      workloadOk: true,
      workLifeBalanceOk: true,
      comments: 'Tout va bien',
    },
    1,
  );
  assert.ok(e.id > 0);
  assert.equal(e.type, 'annuel');
  assert.equal(e.workload_ok, 1);
  const list = listEntretiens(db, 10, 2026);
  assert.equal(list.length, 1);
});

test('updateEntretien — patch partiel', () => {
  const db = makeDb();
  const e = createEntretien(db, { personId: 10, year: 2026, type: 'annuel' }, 1);
  const upd = updateEntretien(
    db,
    e.id,
    { heldDate: '2026-07-01', status: 'held', workloadOk: false },
    1,
  );
  assert.equal(upd.held_date, '2026-07-01');
  assert.equal(upd.status, 'held');
  assert.equal(upd.workload_ok, 0);
});

test('getEntretienComplianceForYear — non conforme si rien', () => {
  const db = makeDb();
  const c = getEntretienComplianceForYear(db, 10, 2026);
  assert.equal(c.compliant, false);
  assert.equal(c.annuelHeld, false);
  assert.deepEqual(c.missing, ['annuel', 'semestriel', 'semestriel']);
});

test('getEntretienComplianceForYear — conforme si 1 annuel + 2 semestriels', () => {
  const db = makeDb();
  createEntretien(
    db,
    { personId: 10, year: 2026, type: 'annuel', heldDate: '2026-06-01', status: 'held' },
    1,
  );
  createEntretien(
    db,
    { personId: 10, year: 2026, type: 'semestriel', heldDate: '2026-03-01', status: 'held' },
    1,
  );
  createEntretien(
    db,
    { personId: 10, year: 2026, type: 'semestriel', heldDate: '2026-09-01', status: 'held' },
    1,
  );
  const c = getEntretienComplianceForYear(db, 10, 2026);
  assert.equal(c.compliant, true);
  assert.equal(c.semestrielsHeldCount, 2);
});

// ─── Alertes ────────────────────────────────────────────────
test('createAlert + listAlerts + resolveAlert', () => {
  const db = makeDb();
  const a = createAlert(
    db,
    { personId: 10, category: 'charge_travail', reason: 'Surcharge sur juin' },
    1,
  );
  assert.equal(a.status, 'open');
  const open = listAlerts(db, 10, { status: 'open' });
  assert.equal(open.length, 1);
  const resolved = resolveAlert(db, a.id, { response: 'Réunion tenue' }, 1);
  assert.equal(resolved.status, 'resolved');
  assert.equal(resolved.response, 'Réunion tenue');
  const stillOpen = listAlerts(db, 10, { status: 'open' });
  assert.equal(stillOpen.length, 0);
});

// ─── Poses ──────────────────────────────────────────────────
test('createRestPose + UNIQUE (person, date, period)', () => {
  const db = makeDb();
  const p1 = createRestPose(db, { personId: 10, poseDate: '2026-06-15', period: 'AM' }, 1);
  assert.ok(p1.id > 0);
  // AM et PM sont autorisés le même jour
  const p2 = createRestPose(db, { personId: 10, poseDate: '2026-06-15', period: 'PM' }, 1);
  assert.ok(p2.id > 0);
  // Duplicate AM → doit throw
  assert.throws(() =>
    createRestPose(db, { personId: 10, poseDate: '2026-06-15', period: 'AM' }, 1),
  );
});

test('listRestPoses — filtres', () => {
  const db = makeDb();
  createRestPose(
    db,
    { personId: 10, poseDate: '2026-06-15', poseType: 'repos_conv' },
    1,
  );
  createRestPose(
    db,
    { personId: 10, poseDate: '2026-07-15', poseType: 'rachat' },
    1,
  );
  const all = listRestPoses(db, 10);
  assert.equal(all.length, 2);
  const june = listRestPoses(db, 10, { fromDate: '2026-06-01', toDate: '2026-06-30' });
  assert.equal(june.length, 1);
  const rachat = listRestPoses(db, 10, { type: 'rachat' });
  assert.equal(rachat.length, 1);
});

test('countPosesByType — agrégation avec 1/2j', () => {
  const db = makeDb();
  createRestPose(
    db,
    { personId: 10, poseDate: '2026-06-10', period: 'FULL', poseType: 'repos_conv' },
    1,
  );
  createRestPose(
    db,
    { personId: 10, poseDate: '2026-06-11', period: 'AM', poseType: 'repos_conv' },
    1,
  );
  createRestPose(
    db,
    { personId: 10, poseDate: '2026-06-11', period: 'PM', poseType: 'rachat' },
    1,
  );
  const counts = countPosesByType(db, 10, '2026-01-01', '2026-12-31');
  assert.equal(counts.repos_conv, 1.5);
  assert.equal(counts.rachat, 0.5);
});

test('createRestPose — statut cancelled exclu du comptage', () => {
  const db = makeDb();
  const p = createRestPose(
    db,
    { personId: 10, poseDate: '2026-06-15', period: 'FULL', poseType: 'repos_conv' },
    1,
  );
  db.prepare("UPDATE forfait_rest_poses SET status='cancelled' WHERE id=?").run(p.id);
  const counts = countPosesByType(db, 10, '2026-01-01', '2026-12-31');
  assert.equal(counts.repos_conv ?? 0, 0);
});
