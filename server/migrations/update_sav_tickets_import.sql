-- Migration: Ajouter champs import et rendre equipment_id nullable
-- pour permettre les tickets SAV importés non encore liés à un équipement

CREATE TABLE IF NOT EXISTS sav_tickets_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  equipment_id INTEGER,
  reported_by INTEGER,
  assigned_to INTEGER,
  type TEXT NOT NULL DEFAULT 'panne',
  priority TEXT NOT NULL DEFAULT 'medium',
  status TEXT NOT NULL DEFAULT 'open',
  title TEXT NOT NULL,
  description TEXT,
  resolution TEXT,
  cost REAL,
  import_code TEXT,
  import_serial TEXT,
  import_name TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  resolved_at DATETIME,
  FOREIGN KEY (equipment_id) REFERENCES equipment(id),
  FOREIGN KEY (reported_by) REFERENCES users(id),
  FOREIGN KEY (assigned_to) REFERENCES persons(id)
);

INSERT INTO sav_tickets_new (id, equipment_id, reported_by, assigned_to, type, priority, status, title, description, resolution, cost, created_at, updated_at, resolved_at)
SELECT id, equipment_id, reported_by, assigned_to, type, priority, status, title, description, resolution, cost, created_at, updated_at, resolved_at FROM sav_tickets;

DROP TABLE sav_tickets;

ALTER TABLE sav_tickets_new RENAME TO sav_tickets;

CREATE INDEX IF NOT EXISTS idx_sav_tickets_equipment_id ON sav_tickets(equipment_id);
