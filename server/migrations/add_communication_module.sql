-- Migration : Module Communication (Affichage dynamique + Planification + Import BL)
-- Date : 2026-02-25
-- Branche : dev

-- ═══ TABLE : ÉVÉNEMENTS D'AFFICHAGE DYNAMIQUE ═══
-- Remplace l'ancien système basé sur Google Calendar
CREATE TABLE IF NOT EXISTS dynamic_display_events (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  affaire_id TEXT,
  bl_import_id TEXT,
  type TEXT NOT NULL CHECK(type IN ('preparation', 'enlevement', 'livraison', 'depart', 'retour', 'recuperation')),
  category TEXT NOT NULL CHECK(category IN ('vente', 'location', 'prestation', 'installation')),
  date TEXT NOT NULL,
  period TEXT CHECK(period IN ('AM', 'PM') OR period IS NULL),
  time TEXT,
  comment TEXT DEFAULT '',
  client TEXT DEFAULT '',
  location TEXT DEFAULT '',
  created_by INTEGER REFERENCES users(id),
  created_at TEXT DEFAULT (datetime('now')),
  modified_by INTEGER,
  modified_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_dde_date ON dynamic_display_events(date);
CREATE INDEX IF NOT EXISTS idx_dde_affaire ON dynamic_display_events(affaire_id);
CREATE INDEX IF NOT EXISTS idx_dde_type ON dynamic_display_events(type);
CREATE INDEX IF NOT EXISTS idx_dde_category ON dynamic_display_events(category);

-- ═══ TABLE : IMPORTS DE BL ═══
-- Stockage des bons de livraison importés (PDF/images)
CREATE TABLE IF NOT EXISTS bl_imports (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  affaire_id TEXT,
  filename TEXT NOT NULL,
  file_path TEXT,
  mime_type TEXT,
  raw_text TEXT,
  parsed_data TEXT,
  status TEXT DEFAULT 'validated' CHECK(status IN ('pending', 'validated', 'rejected')),
  affaire_type TEXT,
  doc_type TEXT,
  confidence_score REAL,
  sections_data TEXT,
  field_confidence TEXT,
  created_by INTEGER REFERENCES users(id),
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_bl_affaire ON bl_imports(affaire_id);
CREATE INDEX IF NOT EXISTS idx_bl_status ON bl_imports(status);

-- ═══ TABLE : ASSIGNATIONS DE TÂCHES (PLANIFICATION) ═══
-- Tâches du planning journalier/hebdomadaire, liées à un affichage dynamique ou manuelles
CREATE TABLE IF NOT EXISTS task_assignments (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  display_event_id TEXT REFERENCES dynamic_display_events(id) ON DELETE SET NULL,
  person_id INTEGER REFERENCES persons(id) ON DELETE SET NULL,
  date TEXT NOT NULL,
  period TEXT CHECK(period IN ('AM', 'PM') OR period IS NULL),
  time TEXT,
  section TEXT CHECK(section IN (
    'prep_locations', 'prep_prestations', 'prep_ventes',
    'taches_prioritaires', 'taches_secondaires', 'courses', 'manual'
  )),
  title TEXT,
  notes TEXT DEFAULT '',
  source_type TEXT DEFAULT 'display_event' CHECK(source_type IN ('display_event', 'manual', 'google_event')),
  source_id TEXT,
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'in_progress', 'done', 'cancelled')),
  created_by INTEGER REFERENCES users(id),
  created_at TEXT DEFAULT (datetime('now')),
  modified_by INTEGER,
  modified_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_ta_date ON task_assignments(date);
CREATE INDEX IF NOT EXISTS idx_ta_person ON task_assignments(person_id);
CREATE INDEX IF NOT EXISTS idx_ta_display ON task_assignments(display_event_id);
CREATE INDEX IF NOT EXISTS idx_ta_section ON task_assignments(section);
CREATE INDEX IF NOT EXISTS idx_ta_status ON task_assignments(status);

-- Rollback :
-- DROP TABLE IF EXISTS task_assignments;
-- DROP TABLE IF EXISTS bl_imports;
-- DROP TABLE IF EXISTS dynamic_display_events;
