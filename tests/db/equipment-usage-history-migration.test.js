import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

import Database from 'better-sqlite3';

import { runEquipmentUsageHistoryMigration } from '../../apps/api/migrations/equipment-usage-history-v1.js';

let db;

before(() => {
  db = new Database(':memory:');
  db.exec(`
    CREATE TABLE equipment (
      id INTEGER PRIMARY KEY,
      serial_number TEXT,
      is_serialized INTEGER DEFAULT 0
    );
    CREATE TABLE users (id INTEGER PRIMARY KEY);
    INSERT INTO equipment (id, serial_number) VALUES (1, 'SERIAL-001');
    INSERT INTO equipment (id, serial_number) VALUES (2, NULL);
  `);
});

after(() => db.close());

describe('equipment usage history migration', () => {
  it('marks existing serial-numbered equipment serialized without changing other equipment', () => {
    runEquipmentUsageHistoryMigration(db);

    assert.equal(
      db.prepare('SELECT is_serialized FROM equipment WHERE id = 1').get().is_serialized,
      1,
    );
    assert.equal(
      db.prepare('SELECT is_serialized FROM equipment WHERE id = 2').get().is_serialized,
      0,
    );
    assert.ok(db.pragma('table_info(equipment_usage_history)').length > 0);
  });

  it('is safe to run more than once', () => {
    assert.doesNotThrow(() => runEquipmentUsageHistoryMigration(db));
  });
});
