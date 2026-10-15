import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';

import Database from 'better-sqlite3';

import { getTaskReservationVehicles } from '../apps/api/services/display/taskVehicles.js';

let db;

before(() => {
  db = new Database(':memory:');
  db.exec(`
    CREATE TABLE task_assignments (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      visible INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'pending',
      deleted_at TEXT,
      affaire_num TEXT,
      reservation_id TEXT
    );
    CREATE TABLE reservations (
      id TEXT PRIMARY KEY,
      affaire TEXT,
      vehicle_id TEXT NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL
    );
    CREATE TABLE vehicles (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      registration TEXT
    );

    INSERT INTO vehicles (id, name, registration) VALUES
      ('v1', 'Camion 1', 'AB-123-CD'),
      ('v2', 'Camion 2', 'EF-456-GH'),
      ('v3', 'Camion 3', 'IJ-789-KL');
    INSERT INTO reservations (id, affaire, vehicle_id, start_date, end_date) VALUES
      ('r1', 'AF-100', 'v1', '2026-10-15', '2026-10-15'),
      ('r2', 'AF-100', 'v2', '2026-10-15', '2026-10-15'),
      ('r3', 'AF-200', 'v3', '2026-10-15', '2026-10-15'),
      ('r4', 'AF-100', 'v3', '2026-10-16', '2026-10-16');
    INSERT INTO task_assignments (id, date, affaire_num) VALUES
      ('t1', '2026-10-15', 'AF-100'),
      ('t2', '2026-10-15', 'AF-200'),
      ('t3', '2026-10-15', 'AF-300');
  `);
});

after(() => {
  db.close();
});

test('retourne uniquement les véhicules réservés pour chaque affaire et la date de tâche', () => {
  const vehiclesByTask = getTaskReservationVehicles(db, '2026-10-15');

  assert.deepEqual(vehiclesByTask.get('t1'), [
    { name: 'Camion 1', registration: 'AB-123-CD' },
    { name: 'Camion 2', registration: 'EF-456-GH' },
  ]);
  assert.deepEqual(vehiclesByTask.get('t2'), [{ name: 'Camion 3', registration: 'IJ-789-KL' }]);
  assert.equal(vehiclesByTask.has('t3'), false);
});
